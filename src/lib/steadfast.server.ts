// Server-only. কখনো route/component/*.functions.ts থেকে top-level import করবেন না —
// শুধু অন্য *.server.ts ফাইল থেকে, অথবা createServerFn handler-এর ভিতরে dynamic import করে।
const STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1";

function steadfastCredentials(): { apiKey: string; secretKey: string } {
  const apiKey = process.env.STEADFAST_API_KEY;
  const secretKey = process.env.STEADFAST_SECRET_KEY;
  if (!apiKey || !secretKey) {
    // NOTE: only report the *names* of the missing env vars — never the
    // key values themselves (an earlier version of this file accidentally
    // hardcoded the real key/secret here, which leaked them into any error
    // message / log this function ever threw).
    const missing = [
      ...(!apiKey ? ["STEADFAST_API_KEY"] : []),
      ...(!secretKey ? ["STEADFAST_SECRET_KEY"] : []),
    ];
    throw new Error(
      `Missing Steadfast credential(s): ${missing.join(", ")}. Set them as runtime secrets ` +
        `(e.g. \`npx wrangler secret put STEADFAST_API_KEY\`) and redeploy.`,
    );
  }
  return { apiKey, secretKey };
}

async function steadfastFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, secretKey } = steadfastCredentials();
  const url = `${STEADFAST_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        ...(init?.headers ?? {}),
      },
    });
  } catch (networkError: any) {
    // fetch() itself threw — DNS/TLS/connection failure, not an HTTP error.
    throw new Error(
      `Could not reach Steadfast (${url}): ${networkError?.message ?? networkError}`,
    );
  }
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    const looksLikeHtml = /<\s*html/i.test(text);
    const hint = looksLikeHtml
      ? " This looks like an HTML page rather than a Steadfast API response — double check the " +
        "request path/method against Steadfast's current API docs, and confirm this endpoint is " +
        "enabled for your merchant account."
      : "";
    throw new Error(
      `Steadfast returned non-JSON response (HTTP ${res.status}) from ${url}: ` +
        `${text.slice(0, 300)}${hint}`,
    );
  }
  if (!res.ok) {
    const message = body?.message || body?.errors || `Steadfast API error (HTTP ${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return body as T;
}

export type SteadfastOrderInput = {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
};

export type SteadfastConsignment = {
  consignment_id: number;
  invoice: string;
  tracking_code: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number | string;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type SteadfastCreateOrderResponse = {
  status: number;
  message: string;
  consignment: SteadfastConsignment;
};

export async function createSteadfastOrder(
  order: SteadfastOrderInput,
): Promise<SteadfastCreateOrderResponse> {
  return steadfastFetch<SteadfastCreateOrderResponse>("/create_order", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export type SteadfastBulkOrderResult = {
  invoice: string;
  recipient_name: string;
  recipient_address: string;
  recipient_phone: string;
  cod_amount: string;
  note: string | null;
  consignment_id?: number;
  tracking_code?: string;
  status: "success" | "error";
  errors?: unknown;
};

export async function createSteadfastBulkOrder(
  orders: SteadfastOrderInput[],
): Promise<SteadfastBulkOrderResult[]> {
  if (orders.length === 0) return [];
  if (orders.length > 500) {
    throw new Error("Steadfast bulk_order supports at most 500 orders per request.");
  }
  const body = await steadfastFetch<{ data: SteadfastBulkOrderResult[] }>(
    "/create_order/bulk_order",
    { method: "POST", body: JSON.stringify({ data: orders }) },
  );
  return body.data ?? [];
}

export type SteadfastStatusResponse = { status: number; delivery_status: string };

export async function getSteadfastStatusByConsignmentId(
  consignmentId: string | number,
): Promise<SteadfastStatusResponse> {
  return steadfastFetch(`/status_by_cid/${encodeURIComponent(String(consignmentId))}`);
}

export function mapSteadfastStatusToOrderStatus(courierStatus: string): string | null {
  if (courierStatus === "delivered" || courierStatus === "partial_delivered") return "delivered";
  if (courierStatus === "cancelled") return "cancelled";
  if (courierStatus === "hold" || courierStatus === "in_review" || courierStatus === "pending") {
    return "shipped";
  }
  return null;
}

export function verifySteadfastWebhookToken(authorizationHeader: string | null): boolean {
  const expected = process.env.STEADFAST_WEBHOOK_TOKEN;
  if (!expected) {
    console.error("[steadfast] STEADFAST_WEBHOOK_TOKEN not configured — rejecting webhook");
    return false;
  }
  if (!authorizationHeader) return false;
  const token = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  return token === expected;
}

