/**
 * Google Tag Manager (web container) + dataLayer ecommerce event।
 *
 * Admin → Google Tag Manager পেজে শুধু GTM ID (GTM-XXXXXXX) বসালেই:
 *   - gtm.js লোড হয়
 *   - GA4-এর standard ecommerce event dataLayer-এ push হয়:
 *       page_view, view_item, add_to_cart, begin_checkout, purchase
 *   - GTM-এর ভিতরে GA4 / Google Ads / Facebook / TikTok — যেকোনো tag এই event
 *     দিয়ে চালানো যায়
 *
 * "Server container URL" দিলে (যেমন Stape.io থেকে পাওয়া https://sgtm.yourdomain.com)
 * gtm.js সেই first-party server থেকে লোড হয় — এটাই server-side GTM সেটআপ।
 *
 * ID ফরম্যাট ভুল হলে কিছুই লোড হয় না। সব call try/catch — দোকান কখনো ভাঙবে না।
 */

type DL = Record<string, unknown>;

let initialised = false;
let pending: DL[] = [];

export function isValidGtmId(id?: string | null): boolean {
  return /^GTM-[A-Z0-9]{4,12}$/.test((id ?? "").trim().toUpperCase());
}

export function isValidGtmServerUrl(url?: string | null): boolean {
  const v = (url ?? "").trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.search && !u.hash;
  } catch {
    return false;
  }
}

export function isValidGa4Id(id?: string | null): boolean {
  const v = (id ?? "").trim();
  return v === "" || /^G-[A-Z0-9]{4,15}$/.test(v.toUpperCase());
}

function dataLayer(): DL[] | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { dataLayer?: DL[] };
  w.dataLayer = w.dataLayer || [];
  return w.dataLayer;
}

export function initGtm(id?: string | null, serverUrl?: string | null): void {
  if (typeof window === "undefined" || initialised) return;
  const gtmId = (id ?? "").trim().toUpperCase();
  if (!isValidGtmId(gtmId)) return;
  const base =
    isValidGtmServerUrl(serverUrl) && serverUrl?.trim()
      ? serverUrl.trim().replace(/\/+$/, "")
      : "https://www.googletagmanager.com";
  try {
    const dl = dataLayer();
    if (!dl) return;
    dl.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const s = document.createElement("script");
    s.async = true;
    s.src = `${base}/gtm.js?id=${encodeURIComponent(gtmId)}`;
    document.head.appendChild(s);
  } catch {
    return;
  }
  initialised = true;
  const queued = pending;
  pending = [];
  queued.forEach(push);
}

function push(obj: DL) {
  if (typeof window === "undefined") return;
  if (!initialised) {
    if (pending.length < 30) pending.push(obj);
    return;
  }
  try {
    const dl = dataLayer();
    if (!dl) return;
    // আগের ecommerce object মুছে দেওয়া — Google-এর recommended pattern
    if ("ecommerce" in obj) dl.push({ ecommerce: null });
    dl.push(obj);
  } catch {
    /* ignore */
  }
}

type GtmItem = { item_id: string; item_name: string; price: number; quantity: number };

export function gtmPageView(path: string) {
  push({
    event: "page_view",
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : path,
  });
}

export function gtmViewItem(p: { slug: string; name: string; price: number }) {
  push({
    event: "view_item",
    ecommerce: {
      currency: "BDT",
      value: p.price,
      items: [{ item_id: p.slug, item_name: p.name, price: p.price, quantity: 1 }],
    },
  });
}

export function gtmAddToCart(p: { slug: string; name: string; price: number; quantity: number }) {
  push({
    event: "add_to_cart",
    ecommerce: {
      currency: "BDT",
      value: p.price * p.quantity,
      items: [{ item_id: p.slug, item_name: p.name, price: p.price, quantity: p.quantity }],
    },
  });
}

export function gtmBeginCheckout(cart: { items: GtmItem[]; value: number }) {
  push({
    event: "begin_checkout",
    ecommerce: { currency: "BDT", value: cart.value, items: cart.items },
  });
}

/**
 * transaction_id = order number — GA4 একই transaction_id দুইবার গোনে না, আর
 * server-side Measurement Protocol-ও একই ID পাঠায়।
 */
export function gtmPurchase(order: {
  orderNo: string;
  value: number;
  shipping: number;
  discount: number;
  phone?: string;
  items: GtmItem[];
}) {
  push({
    event: "purchase",
    event_id: `purchase-${order.orderNo}`,
    ecommerce: {
      transaction_id: order.orderNo,
      currency: "BDT",
      value: order.value,
      shipping: order.shipping,
      discount: order.discount,
      items: order.items,
    },
    // Google Ads Enhanced Conversions / Meta-TikTok tag-এর জন্য (GTM নিজে hash করে)
    user_data: order.phone ? { phone_number: "+88" + order.phone } : undefined,
  });
}
