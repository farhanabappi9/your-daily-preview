// Server-only. কখনো route/component/*.functions.ts থেকে top-level import করবেন না —
// শুধু অন্য *.server.ts ফাইল থেকে, অথবা createServerFn handler-এর ভিতরে dynamic import করে।
const STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1";

function steadfastCredentials(): { apiKey: string; secretKey: string } {
  const apiKey = process.env.STEADFAST_API_KEY;
  const secretKey = process.env.STEADFAST_SECRET_KEY;
  if (!apiKey || !secretKey) {
    const missing = [
      ...(!apiKey ? ["STEADFAST_API_KEY"] : []),
      ...(!secretKey ? ["STEADFAST_SECRET_KEY"] : []),
    ];
    throw new Error(`Missing Steadfast credential(s): ${missing.join(", ")}.`);
  }
  return { apiKey, secretKey };
}

async function steadfastFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, secretKey } = steadfastCredentials();
  const res = await fetch(`${STEADFAST_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "Secret-Key": secretKey,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Steadfast returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`);
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

/**
 * Steadfast delivery_status webhook-এর `status` field lowercase আর capitalized
 * দুই রকমই আসতে পারে (তাদের নিজস্ব ডকুমেন্টেশনেই example capitalized, field-table
 * lowercase দেখায়) — তাই সবসময় normalize করে compare করি।
 * সম্ভাব্য মান: pending, delivered, partial_delivered, cancelled, unknown
 * (আগে create_order/status API নিজে থেকে hold, in_review-ও দিতে পারে, সেগুলোও রাখলাম)
 */
export function mapSteadfastStatusToOrderStatus(courierStatus: string): string | null {
  const s = courierStatus.trim().toLowerCase();
  if (s === "delivered" || s === "partial_delivered") return "delivered";
  if (s === "cancelled") return "cancelled";
  if (s === "hold" || s === "in_review" || s === "pending") return "shipped";
  return null; // "unknown" বা অচেনা কোনো মান — নিজেদের status অপরিবর্তিত রাখি
}

