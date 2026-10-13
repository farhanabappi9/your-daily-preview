import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type OrderForCourier = {
  id: string;
  order_no: string;
  customer_name: string;
  phone: string;
  address: string;
  note: string | null;
  subtotal: number | string | null;
  shipping: number | string | null;
  discount: number | string | null;
  total: number | string | null;
  payment_method: string | null;
  payment_status: string | null;
  courier_consignment_id: string | null;
};

// orders টেবিল থেকে Steadfast-এর জন্য যা যা দরকার সব এক জায়গায় — দুই জায়গায় select আলাদা
// লিখলে একটায় column বাদ পড়ে যায়, তাই একটাই const।
const ORDER_COURIER_COLUMNS =
  "id, order_no, customer_name, phone, address, note, subtotal, shipping, discount, total, payment_method, payment_status, courier_consignment_id";

// এই payment method গুলো অনলাইনে আগেই পেমেন্ট হয়ে যায় — এগুলোতে কুরিয়ারের COD = 0।
// বাকি সব (cod, COD, "Cash on Delivery", খালি/null ...) COD হিসেবে ধরা হবে।
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

function resolveOrderTotal(order: OrderForCourier): number {
  const total = Number(order.total);
  if (Number.isFinite(total) && total > 0) return Math.round(total);
  // total কোনো কারণে 0/null হলে subtotal - discount + shipping থেকে হিসাব করি।
  const subtotal = Number(order.subtotal ?? 0);
  const shipping = Number(order.shipping ?? 0);
  const discount = Number(order.discount ?? 0);
  const computed = Math.max(0, subtotal - discount) + shipping;
  return Number.isFinite(computed) ? Math.round(computed) : 0;
}

function computeCodAmount(order: OrderForCourier): number {
  // আগে ছিল: payment_method === "cod" ? total : 0
  // সমস্যা: "COD" / "Cash on Delivery" / null হলে exact match মিলত না, ফলে 0 যেত।
  const method = String(order.payment_method ?? "").trim().toLowerCase();
  const status = String(order.payment_status ?? "").trim().toLowerCase();

  if (status === "paid") return 0; // আগেই পেমেন্ট হয়ে গেছে, ক্যাশ নেওয়ার কিছু নেই
  if (PREPAID_METHODS.has(method)) return 0;
  return resolveOrderTotal(order);
}

function buildSteadfastPayload(order: OrderForCourier) {
  const codAmount = computeCodAmount(order);
  console.log(
    "[steadfast] payload cod_amount:",
    JSON.stringify({
      order_no: order.order_no,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      total: order.total,
      cod_amount: codAmount,
    }),
  );
  return {
    invoice: order.order_no,
    recipient_name: order.customer_name,
    recipient_phone: order.phone,
    recipient_address: order.address,
    cod_amount: codAmount,
    note: order.note ?? undefined,
  };
}

export const sendOrderToCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: order, error } = await db
      .from("orders")
      .select(ORDER_COURIER_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order পাওয়া যায়নি বা অনুমতি নেই।");
    if (order.courier_consignment_id) {
      throw new Error("এই অর্ডারটি আগেই Steadfast-এ পাঠানো হয়েছে।");
    }

    const { createSteadfastOrder } = await import("@/lib/steadfast.server");

    try {
      const result = await createSteadfastOrder(buildSteadfastPayload(order));
      const c = result.consignment;
      const { error: updateError } = await db
        .from("orders")
        .update({
          courier_provider: "steadfast",
          courier_consignment_id: String(c.consignment_id),
          courier_tracking_code: c.tracking_code,
          courier_status: c.status,
          courier_sent_at: new Date().toISOString(),
          courier_last_synced_at: new Date().toISOString(),
          courier_error: null,
        })
        .eq("id", data.id);
      if (updateError) throw new Error(updateError.message);
      return { ok: true as const, consignment: c };
    } catch (e: any) {
      const message = String(e?.message ?? e);
      await db.from("orders").update({ courier_error: message }).eq("id", data.id);
      return { ok: false as const, error: message };
    }
  });

export const bulkSendOrdersToCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: orders, error } = await db
      .from("orders")
      .select(ORDER_COURIER_COLUMNS)
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    const eligible = (orders ?? []).filter((o: OrderForCourier) => !o.courier_consignment_id);
    const alreadySent = (orders ?? []).length - eligible.length;
    if (eligible.length === 0) {
      return { ok: true as const, sent: 0, failed: 0, alreadySent, results: [] };
    }

    const { createSteadfastBulkOrder } = await import("@/lib/steadfast.server");
    const payload = eligible.map(buildSteadfastPayload);
    const results = await createSteadfastBulkOrder(payload);

    const byInvoice = new Map(eligible.map((o: OrderForCourier) => [o.order_no, o]));
    let sent = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const r of results) {
      const order = byInvoice.get(r.invoice);
      if (!order) continue;
      if (r.status === "success" && r.consignment_id && r.tracking_code) {
        sent++;
        await db
          .from("orders")
          .update({
            courier_provider: "steadfast",
            courier_consignment_id: String(r.consignment_id),
            courier_tracking_code: r.tracking_code,
            courier_status: "pending",
            courier_sent_at: now,
            courier_last_synced_at: now,
            courier_error: null,
          })
          .eq("id", order.id);
      } else {
        failed++;
        await db
          .from("orders")
          .update({ courier_error: JSON.stringify(r.errors ?? "unknown error") })
          .eq("id", order.id);
      }
    }

    return { ok: true as const, sent, failed, alreadySent, results };
  });

export const refreshCourierStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: order, error } = await db
      .from("orders")
      .select("id, courier_consignment_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order?.courier_consignment_id) {
      throw new Error("এই অর্ডারটি এখনো Steadfast-এ পাঠানো হয়নি।");
    }

    const { getSteadfastStatusByConsignmentId, mapSteadfastStatusToOrderStatus } = await import(
      "@/lib/steadfast.server"
    );
    const result = await getSteadfastStatusByConsignmentId(order.courier_consignment_id);

    const patch: Record<string, unknown> = {
      courier_status: result.delivery_status,
      courier_last_synced_at: new Date().toISOString(),
    };
    const mappedStatus = mapSteadfastStatusToOrderStatus(result.delivery_status);
    if (mappedStatus) patch.status = mappedStatus;

    const { error: updateError } = await db.from("orders").update(patch).eq("id", data.id);
    if (updateError) throw new Error(updateError.message);
    if (mappedStatus) {
      await db.from("order_status_history").insert({ order_id: data.id, status: mappedStatus });
    }

    return { ok: true as const, delivery_status: result.delivery_status, mappedStatus };
  });