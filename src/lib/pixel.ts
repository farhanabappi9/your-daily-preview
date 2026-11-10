/**
 * Meta (Facebook) Pixel helper.
 *
 * আগে Pixel ID কোডে hardcode করা ছিল আর base code SSR-এ বসানো থাকত — admin
 * প্যানেল থেকে বদলানোর কোনো উপায় ছিল না। এখন TikTok-এর মতোই:
 *   - Admin → Facebook Pixel পেজে ID সেভ হয় (`settings` টেবিলের `shop` blob-এ)
 *   - `__root.tsx`-এর MetaPixelLoader সেই ID দিয়ে base code লোড করে
 *   - ID আসার আগে fire হওয়া event ছোট একটা queue-তে থাকে, init হলে flush হয়
 *   - কখনো সেভ না করা থাকলে পুরনো ID (LEGACY_META_PIXEL_ID) চলে — তাই আপডেটের
 *     পরে ট্র্যাকিং বন্ধ হয় না
 *
 * সার্ভারে সব no-op; প্রতিটি call try/catch — tracking কখনো দোকান ভাঙবে না।
 */

/** আগে কোডে যেই ID বসানো ছিল। Admin থেকে একবার সেভ করলে সেটাই চলবে। */
export const LEGACY_META_PIXEL_ID = "1333331668960638";
/** পুরনো import-গুলো যেন না ভাঙে। */
export const META_PIXEL_ID = LEGACY_META_PIXEL_ID;

export function isValidMetaPixelId(id?: string | null): boolean {
  return /^\d{10,20}$/.test((id ?? "").trim());
}

/** settings থেকে কোন ID চলবে — browser ও server দুই জায়গাতেই একই নিয়ম। */
export function resolveMetaPixelId(s: {
  metaPixelId?: string;
  metaPixelEnabled?: boolean;
}): string {
  if (s.metaPixelEnabled === false) return "";
  if (s.metaPixelId === undefined || s.metaPixelId === null) return LEGACY_META_PIXEL_ID;
  const id = String(s.metaPixelId).trim();
  return isValidMetaPixelId(id) ? id : "";
}

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[] };
type Pending = { event: string; payload?: Record<string, unknown>; eventId?: string };

let initialised = false;
let activeId = "";
let pending: Pending[] = [];

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fn === "function" ? fn : null;
}

export function isMetaPixelReady(): boolean {
  return initialised;
}

export function activeMetaPixelId(): string {
  return activeId;
}

/** Official base code — একবারই চলে। প্রথম PageView এখান থেকেই যায়। */
export function initMetaPixel(pixelId?: string | null): void {
  if (typeof window === "undefined" || initialised) return;
  const id = (pixelId ?? "").trim();
  if (!isValidMetaPixelId(id)) return;
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any, prefer-rest-params, prefer-spread */
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function () {
        if (n.callMethod) n.callMethod.apply(n, arguments);
        else n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      if (s?.parentNode) s.parentNode.insertBefore(t, s);
      else b.head.appendChild(t);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable @typescript-eslint/no-explicit-any, prefer-rest-params, prefer-spread */
    const f = fbq();
    if (!f) return;
    f("init", id);
    f("track", "PageView");
  } catch {
    return;
  }
  initialised = true;
  activeId = id;
  const queued = pending;
  pending = [];
  queued.forEach((p) => send(p.event, p.payload, p.eventId));
}

function send(event: string, payload?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined") return;
  if (!initialised) {
    if (pending.length < 20) pending.push({ event, payload, eventId });
    return;
  }
  const f = fbq();
  if (!f) return;
  try {
    if (eventId) f("track", event, payload ?? {}, { eventID: eventId });
    else f("track", event, payload ?? {});
  } catch {
    /* tracking must never break the page */
  }
}

/** SPA navigation-এ PageView (প্রথমটা base code নিজেই পাঠায়)। */
export function trackPageView() {
  if (!initialised) return; // init নিজেই PageView পাঠাবে — queue করলে ডাবল হয়
  send("PageView");
}

export function trackViewContent(p: { slug: string; name: string; price: number }) {
  send("ViewContent", {
    content_ids: [p.slug],
    content_name: p.name,
    content_type: "product",
    value: p.price,
    currency: "BDT",
  });
}

export function trackAddToCart(p: { slug: string; name: string; price: number; quantity: number }) {
  send("AddToCart", {
    content_ids: [p.slug],
    content_name: p.name,
    content_type: "product",
    contents: [{ id: p.slug, quantity: p.quantity }],
    value: p.price * p.quantity,
    currency: "BDT",
  });
}

export function trackInitiateCheckout(cart: {
  items: { slug: string; quantity: number }[];
  value: number;
}) {
  send("InitiateCheckout", {
    content_ids: cart.items.map((i) => i.slug),
    contents: cart.items.map((i) => ({ id: i.slug, quantity: i.quantity })),
    content_type: "product",
    num_items: cart.items.reduce((sum, i) => sum + i.quantity, 0),
    value: cart.value,
    currency: "BDT",
  });
}

/**
 * অর্ডার সম্পন্ন। event ID = "purchase-<orderNo>" — server-এর Conversions API-ও
 * একই ID পাঠায়, তাই Meta দুইটাকে একটাই অর্ডার ধরে।
 */
export function trackPurchase(order: {
  orderNo: string;
  value: number;
  items: { id: string; name: string; quantity: number; price?: number }[];
}) {
  send(
    "Purchase",
    {
      value: order.value,
      currency: "BDT",
      content_type: "product",
      content_ids: order.items.map((i) => i.id),
      contents: order.items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
      num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
      order_id: order.orderNo,
    },
    `purchase-${order.orderNo}`,
  );
}
