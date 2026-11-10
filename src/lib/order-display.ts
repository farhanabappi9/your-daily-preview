/**
 * Admin প্যানেলে অর্ডারের status / payment / courier status সুন্দর করে দেখানোর
 * pure helper — কোনো browser/server জিনিস নেই, তাই test করা সহজ।
 */

/**
 * ডাটাবেসের ভাঙা default থেকে আসা মান পরিষ্কার করে:
 *   "'cod'::text"    → "cod"
 *   "'unpaid'::text" → "unpaid"
 *   "cod"            → "cod" (ঠিক মান অপরিবর্তিত)
 */
export function cleanDbLiteral(value: unknown): string {
  const t = String(value ?? "").trim();
  const m = /^'(.*)'(?:::[a-z ]+)?$/i.exec(t);
  return (m ? m[1] : t).trim();
}

/** ডাটাবেসে ভাঙা default-এর মান আছে কিনা ("'cod'::text" ধরনের)। */
export function isBrokenDbLiteral(value: unknown): boolean {
  return /^'.*'::[a-z ]+$/i.test(String(value ?? "").trim());
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "নতুন",
  confirmed: "কনফার্ম",
  processing: "প্রসেসিং",
  shipped: "শিপড",
  delivered: "ডেলিভারড",
  cancelled: "বাতিল",
  returned: "রিটার্ন",
};

export const ORDER_STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
  returned: "bg-orange-100 text-orange-800",
};

export function orderStatusLabel(status: unknown): string {
  const s = cleanDbLiteral(status).toLowerCase();
  return ORDER_STATUS_LABEL[s] ?? (s || "—");
}

export function orderStatusTone(status: unknown): string {
  return ORDER_STATUS_TONE[cleanDbLiteral(status).toLowerCase()] ?? "bg-muted text-foreground";
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "COD",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "Card",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "বাকি",
  paid: "পরিশোধিত",
  refunded: "ফেরত",
};

/** "'cod'::text" + "'unpaid'::text" → "COD · বাকি" */
export function paymentLabel(method: unknown, status: unknown): string {
  const m = cleanDbLiteral(method).toLowerCase();
  const s = cleanDbLiteral(status).toLowerCase();
  const mm = PAYMENT_METHOD_LABEL[m] ?? (m || "—");
  const ss = PAYMENT_STATUS_LABEL[s] ?? (s || "—");
  return `${mm} · ${ss}`;
}

/** Steadfast-এর delivery_status → বাংলা */
const COURIER_STATUS_LABEL: Record<string, string> = {
  pending: "কুরিয়ারে পাঠানো",
  in_review: "Steadfast রিভিউ করছে",
  hold: "হোল্ডে",
  delivered: "ডেলিভারড",
  partial_delivered: "আংশিক ডেলিভারি",
  delivered_approval_pending: "ডেলিভারড (অনুমোদন বাকি)",
  partial_delivered_approval_pending: "আংশিক (অনুমোদন বাকি)",
  cancelled: "কুরিয়ারে বাতিল",
  cancelled_approval_pending: "বাতিল (অনুমোদন বাকি)",
  unknown: "অজানা",
  unknown_approval_pending: "অজানা (অনুমোদন বাকি)",
};

export function courierStatusLabel(status: unknown): string {
  const s = cleanDbLiteral(status).toLowerCase();
  if (!s) return COURIER_STATUS_LABEL.pending;
  return COURIER_STATUS_LABEL[s] ?? s;
}

/** পুরনো অর্ডারের সোর্স SQL দিয়ে আন্দাজে বসানো হয়েছে কিনা */
export function isEstimatedSource(attribution: unknown): boolean {
  const by = (attribution as { detected_by?: unknown } | null | undefined)?.detected_by;
  return typeof by === "string" && by.startsWith("legacy_");
}

export const DETECTED_BY_LABEL: Record<string, string> = {
  legacy_same_phone: "আনুমানিক — একই ফোন নম্বরের পরের অর্ডারের সোর্স থেকে",
  legacy_coupon: "আনুমানিক — কুপন কোড থেকে",
  legacy_estimate: "আনুমানিক — ট্র্যাকিং চালুর আগের অর্ডার, দোকানের মূল বিজ্ঞাপন সোর্স ধরা হয়েছে",
  ttclid: "TikTok বিজ্ঞাপনের click id",
  fbclid: "Facebook বিজ্ঞাপনের click id",
  gclid: "Google বিজ্ঞাপনের click id",
  utm_source: "লিংকের utm_source",
  referrer: "যে সাইট থেকে এসেছে",
  in_app_browser: "অ্যাপের ভিতরের ব্রাউজার (Facebook/Instagram/TikTok)",
  none: "সরাসরি (কোনো চিহ্ন নেই)",
};

export function detectedByLabel(by: unknown): string | undefined {
  if (typeof by !== "string" || !by) return undefined;
  return DETECTED_BY_LABEL[by] ?? by;
}

/** Order statuses shown in the admin status dropdowns and filters. */
export const STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];
