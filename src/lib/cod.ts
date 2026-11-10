/**
 * Steadfast-এ কত টাকা COD (Cash on Delivery) যাবে — pure হিসাব, server ও admin
 * প্যানেল দুই জায়গাতেই একই ফাংশন, তাই "পাঠানোর আগে যা দেখছেন, ঠিক সেটাই যায়"।
 *
 * আগের বাগ: payment_status = "paid" হলে COD = 0 পাঠানো হতো। এই দোকানের সব
 * অর্ডারই Cash on Delivery (চেকআউটে অনলাইন পেমেন্ট নেই), তাই admin প্যানেলে
 * ভুল করে বা হিসাব রাখার জন্য "paid" করে রাখলেই কুরিয়ারে ৳0 চলে যেত।
 *
 * এখনকার নিয়ম:
 *   - COD = total (পণ্যের দাম − ডিসকাউন্ট + ডেলিভারি চার্জ)
 *   - total কোনো কারণে 0/খালি হলে subtotal − discount + shipping থেকে হিসাব
 *   - শুধুমাত্র অনলাইনে আগে পেমেন্ট হওয়া (bkash/nagad/card…) এবং "paid" অর্ডারে COD = 0
 *   - admin চাইলে অর্ডার পেজ থেকে নিজের মতো COD বসিয়ে পাঠাতে পারবেন (যেমন অগ্রিম নেওয়া থাকলে)
 */

export type CodOrder = {
  subtotal?: number | string | null;
  shipping?: number | string | null;
  discount?: number | string | null;
  total?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
};

const PREPAID_METHODS = new Set([
  "bkash",
  "nagad",
  "rocket",
  "upay",
  "card",
  "online",
  "bank",
  "sslcommerz",
  "stripe",
  "paypal",
  "prepaid",
]);

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function orderGrandTotal(order: CodOrder): number {
  const total = num(order.total);
  if (total > 0) return Math.round(total);
  const computed = Math.max(0, num(order.subtotal) - num(order.discount)) + num(order.shipping);
  return Math.max(0, Math.round(computed));
}

export function isPrepaidOrder(order: CodOrder): boolean {
  const method = String(order.payment_method ?? "")
    .trim()
    .toLowerCase();
  const status = String(order.payment_status ?? "")
    .trim()
    .toLowerCase();
  return PREPAID_METHODS.has(method) && status === "paid";
}

export function computeCodAmount(order: CodOrder): number {
  if (isPrepaidOrder(order)) return 0;
  return orderGrandTotal(order);
}
