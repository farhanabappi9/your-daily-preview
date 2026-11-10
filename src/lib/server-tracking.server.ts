// Server-only. শুধু createServerFn handler-এর ভিতরে dynamic import করে ব্যবহার করুন।
//
// Server-side (browser ছাড়া) purchase event পাঠানো:
//   - Facebook Conversions API (CAPI)       → event "Purchase"
//   - TikTok Events API                      → event "CompletePayment"
//   - Google Analytics 4 Measurement Protocol → event "purchase"
//
// কেন: ad blocker, iOS, TikTok/Facebook-এর in-app browser অনেক সময় browser pixel
// আটকে দেয়। Server থেকে পাঠালে সেগুলোও গোনা হয়। browser pixel আর server event
// দুটোতেই একই event_id ("purchase-<order_no>") যায়, তাই প্ল্যাটফর্ম একটাকে বাদ
// দেয় — একটা অর্ডার কখনো দুইবার গোনা হয় না।
//
// এখানে কোনো error কখনো অর্ডার আটকায় না — সব try/catch, সব timeout সহ।

import { resolveMetaPixelId } from "./pixel";

export type TrackingSecrets = {
  metaCapiToken?: string;
  metaTestEventCode?: string;
  tiktokAccessToken?: string;
  tiktokTestEventCode?: string;
  ga4ApiSecret?: string;
};

export type PurchaseEventInput = {
  orderNo: string;
  value: number;
  shipping: number;
  phone: string; // 01XXXXXXXXX
  name: string;
  items: { id: string; name: string; price: number; quantity: number }[];
  ip?: string;
  userAgent?: string;
  pageUrl?: string;
  referrer?: string;
  fbp?: string;
  fbc?: string;
  ttp?: string;
  ttclid?: string;
  gaClientId?: string;
};

export type PublicTrackingIds = {
  metaPixelId?: string;
  metaPixelEnabled?: boolean;
  tiktokPixelId?: string;
  tiktokPixelEnabled?: boolean;
  ga4MeasurementId?: string;
};

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text.slice(0, 300);
}

async function sendMeta(pixelId: string, s: TrackingSecrets, e: PurchaseEventInput) {
  const phone880 = "88" + e.phone; // 8801XXXXXXXXX — Meta-র নিয়মে country code সহ, + ছাড়া
  const firstName = e.name.trim().split(/\s+/)[0] ?? "";
  const user_data: Record<string, unknown> = {
    ph: [await sha256(phone880)],
    external_id: [await sha256(e.phone)],
    country: [await sha256("bd")],
  };
  if (firstName) user_data.fn = [await sha256(firstName)];
  if (e.ip) user_data.client_ip_address = e.ip;
  if (e.userAgent) user_data.client_user_agent = e.userAgent;
  if (e.fbp) user_data.fbp = e.fbp;
  if (e.fbc) user_data.fbc = e.fbc;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `purchase-${e.orderNo}`,
        action_source: "website",
        event_source_url: e.pageUrl,
        user_data,
        custom_data: {
          currency: "BDT",
          value: e.value,
          order_id: e.orderNo,
          content_type: "product",
          content_ids: e.items.map((i) => i.id),
          contents: e.items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
          num_items: e.items.reduce((n, i) => n + i.quantity, 0),
        },
      },
    ],
  };
  if (s.metaTestEventCode) body.test_event_code = s.metaTestEventCode;
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(s.metaCapiToken!)}`;
  return postJson(url, body);
}

async function sendTikTok(pixelId: string, s: TrackingSecrets, e: PurchaseEventInput) {
  const user: Record<string, unknown> = {
    phone: await sha256("+88" + e.phone), // E.164: +8801XXXXXXXXX
    external_id: await sha256(e.phone),
  };
  if (e.ip) user.ip = e.ip;
  if (e.userAgent) user.user_agent = e.userAgent;
  if (e.ttp) user.ttp = e.ttp;
  if (e.ttclid) user.ttclid = e.ttclid;

  const body: Record<string, unknown> = {
    event_source: "web",
    event_source_id: pixelId,
    data: [
      {
        event: "CompletePayment",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `purchase-${e.orderNo}`,
        user,
        page: { url: e.pageUrl, referrer: e.referrer },
        properties: {
          currency: "BDT",
          value: e.value,
          order_id: e.orderNo,
          content_type: "product",
          contents: e.items.map((i) => ({
            content_id: i.id,
            content_name: i.name,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
    ],
  };
  if (s.tiktokTestEventCode) body.test_event_code = s.tiktokTestEventCode;
  const text = await postJson("https://business-api.tiktok.com/open_api/v1.3/event/track/", body, {
    "Access-Token": s.tiktokAccessToken!,
  });
  // TikTok HTTP 200 দিলেও body-তে code ≠ 0 হলে আসলে ব্যর্থ
  try {
    const parsed = JSON.parse(text) as { code?: number; message?: string };
    if (parsed.code && parsed.code !== 0)
      throw new Error(`TikTok code ${parsed.code}: ${parsed.message}`);
  } catch (err) {
    if (err instanceof SyntaxError) return text;
    throw err;
  }
  return text;
}

async function sendGa4(measurementId: string, s: TrackingSecrets, e: PurchaseEventInput) {
  const clientId =
    e.gaClientId ?? `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(s.ga4ApiSecret!)}`;
  return postJson(url, {
    client_id: clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: e.orderNo,
          value: e.value,
          currency: "BDT",
          shipping: e.shipping,
          items: e.items.map((i) => ({
            item_id: i.id,
            item_name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        },
      },
    ],
  });
}

/**
 * যেগুলোর key সেট করা আছে শুধু সেগুলোতেই পাঠায়। ফলাফল (ok/error) ফেরত দেয় যাতে
 * অর্ডারের `server_events` column-এ লিখে রাখা যায় — admin পরে দেখতে পারবেন।
 */
export async function sendServerPurchaseEvents(
  ids: PublicTrackingIds,
  secrets: TrackingSecrets,
  event: PurchaseEventInput,
): Promise<Record<string, string>> {
  const jobs: Array<[string, Promise<unknown>]> = [];

  const metaId = resolveMetaPixelId(ids);
  if (metaId && secrets.metaCapiToken) jobs.push(["facebook", sendMeta(metaId, secrets, event)]);

  const ttId = (ids.tiktokPixelId ?? "").trim();
  if (ttId && ids.tiktokPixelEnabled !== false && secrets.tiktokAccessToken)
    jobs.push(["tiktok", sendTikTok(ttId, secrets, event)]);

  const gaId = (ids.ga4MeasurementId ?? "").trim();
  if (gaId && secrets.ga4ApiSecret) jobs.push(["ga4", sendGa4(gaId, secrets, event)]);

  const out: Record<string, string> = {};
  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  settled.forEach((r, i) => {
    const name = jobs[i][0];
    if (r.status === "fulfilled") out[name] = "ok";
    else {
      const msg = String((r.reason as Error)?.message ?? r.reason).slice(0, 300);
      out[name] = `error: ${msg}`;
      console.error(`[server-tracking] ${name} failed for ${event.orderNo}:`, msg);
    }
  });
  return out;
}

/**
 * Cloudflare-এর আসল `waitUntil` পাওয়া গেলে সেটা ফেরত দেয় — তাহলে event পাঠানোর
 * জন্য কাস্টমারকে অপেক্ষা করতে হয় না (response আগে চলে যায়, event পরে যায়)।
 * Nitro এটা Request-এর উপর বসিয়ে দেয় (`req.waitUntil`)। না পাওয়া গেলে
 * undefined; তখন caller সর্বোচ্চ কয়েক সেকেন্ড অপেক্ষা করে।
 */
export function findWaitUntil(request?: Request): ((p: Promise<unknown>) => void) | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = request as any;
    const direct = r?.waitUntil;
    if (typeof direct === "function") return (p) => direct(p);
    const ctx = r?.runtime?.cloudflare?.context;
    if (ctx && typeof ctx.waitUntil === "function") return (p) => ctx.waitUntil(p);
  } catch {
    /* ignore */
  }
  return undefined;
}
