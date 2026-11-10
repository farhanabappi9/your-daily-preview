import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeCodAmount } from "./cod";
import { normalizeBdPhone } from "./order-source";

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
  order_items?: { name: string; quantity: number }[] | null;
};

// orders টেবিল থেকে Steadfast-এর জন্য যা যা দরকার সব এক জায়গায় — দুই জায়গায় select আলাদা
// লিখলে একটায় column বাদ পড়ে যায়, তাই একটাই const।
const ORDER_COURIER_COLUMNS =
  "id, order_no, customer_name, phone, address, note, subtotal, shipping, discount, total, payment_method, payment_status, courier_consignment_id, order_items(name, quantity)";

/** JSON-safe (server function থেকে ফেরত দেওয়া যায় এমন) bulk ফলাফল। */
type BulkResultRow = {
  invoice: string;
  status: "success" | "error";
  cod_amount: number;
  consignment_id: number | null;
  tracking_code: string | null;
  error: string | null;
};

function itemDescription(order: OrderForCourier): string | undefined {
  const text = (order.order_items ?? [])
    .map((i) => `${i.name} x${i.quantity}`)
    .join(", ")
    .slice(0, 250);
  return text || undefined;
}

/**
 * Steadfast-এ যা যাবে। COD হিসাব `cod.ts`-এ — admin প্যানেলেও ঠিক একই ফাংশন
 * দিয়ে "COD যাবে ৳X" দেখানো হয়।
 *
 * codOverride: admin অর্ডার পেজ থেকে নিজে টাকার পরিমাণ বসালে সেটাই যায়।
 */
function buildSteadfastPayload(order: OrderForCourier, codOverride?: number) {
  const codAmount =
    codOverride !== undefined && Number.isFinite(codOverride) && codOverride >= 0
      ? Math.round(codOverride)
      : computeCodAmount(order);
  const phone = normalizeBdPhone(order.phone) ?? order.phone;
  console.log(
    "[steadfast] payload cod_amount:",
    JSON.stringify({
      order_no: order.order_no,
      total: order.total,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      override: codOverride ?? null,
      cod_amount: codAmount,
    }),
  );
  return {
    invoice: order.order_no,
    recipient_name: order.customer_name,
    recipient_phone: phone,
    recipient_address: order.address.slice(0, 250),
    cod_amount: codAmount,
    note: order.note ?? undefined,
    item_description: itemDescription(order),
  };
}

export const sendOrderToCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; codAmount?: number }) =>
    z
      .object({
        id: z.string().uuid(),
        codAmount: z.number().min(0).max(1_000_000).optional(),
      })
      .parse(d),
  )
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

    const payload = buildSteadfastPayload(order as OrderForCourier, data.codAmount);
    if (payload.cod_amount === 0 && Number(order.total) > 0 && data.codAmount === undefined) {
      // নিরাপত্তা: ভুল করে ৳0 যেন না যায় — admin নিজে 0 বসালে তবেই যাবে
      return {
        ok: false as const,
        error:
          "COD ৳0 হিসাব হচ্ছে (অর্ডারটি অনলাইনে paid মার্ক করা)। সত্যিই ৳0 পাঠাতে চাইলে COD ঘরে 0 লিখে পাঠান।",
      };
    }

    const { createSteadfastOrder } = await import("@/lib/steadfast.server");

    try {
      const result = await createSteadfastOrder(payload);
      const c = result.consignment;
      const returnedCod = Number(c.cod_amount);
      const mismatch =
        Number.isFinite(returnedCod) && returnedCod !== payload.cod_amount
          ? `সতর্কতা: পাঠানো হয়েছে ৳${payload.cod_amount}, Steadfast দেখাচ্ছে ৳${returnedCod}`
          : null;
      const { error: updateError } = await db
        .from("orders")
        .update({
          courier_provider: "steadfast",
          courier_consignment_id: String(c.consignment_id),
          courier_tracking_code: c.tracking_code,
          courier_status: c.status,
          courier_sent_at: new Date().toISOString(),
          courier_last_synced_at: new Date().toISOString(),
          courier_error: mismatch,
        })
        .eq("id", data.id);
      if (updateError) throw new Error(updateError.message);
      return {
        ok: true as const,
        codAmount: payload.cod_amount,
        warning: mismatch,
        consignment: {
          consignment_id: c.consignment_id,
          tracking_code: c.tracking_code,
          status: c.status,
        },
      };
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

    const all = (orders ?? []) as OrderForCourier[];
    const eligible = all.filter((o) => !o.courier_consignment_id);
    const alreadySent = all.length - eligible.length;
    if (eligible.length === 0) {
      return { ok: true as const, sent: 0, failed: 0, alreadySent, results: [] as BulkResultRow[] };
    }

    const { createSteadfastBulkOrder } = await import("@/lib/steadfast.server");
    const payload = eligible.map((o) => buildSteadfastPayload(o));
    const codByInvoice = new Map(payload.map((p) => [p.invoice, p.cod_amount]));
    const raw = await createSteadfastBulkOrder(payload);

    const byInvoice = new Map(eligible.map((o) => [o.order_no, o]));
    let sent = 0;
    let failed = 0;
    const now = new Date().toISOString();
    const results: BulkResultRow[] = [];

    for (const r of raw) {
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
            courier_status: "in_review",
            courier_sent_at: now,
            courier_last_synced_at: now,
            courier_error: null,
          })
          .eq("id", order.id);
        results.push({
          invoice: r.invoice,
          status: "success",
          cod_amount: codByInvoice.get(r.invoice) ?? 0,
          consignment_id: r.consignment_id,
          tracking_code: r.tracking_code,
          error: null,
        });
      } else {
        failed++;
        const msg = JSON.stringify(r.errors ?? "unknown error").slice(0, 500);
        await db.from("orders").update({ courier_error: msg }).eq("id", order.id);
        results.push({
          invoice: r.invoice,
          status: "error",
          cod_amount: codByInvoice.get(r.invoice) ?? 0,
          consignment_id: null,
          tracking_code: null,
          error: msg,
        });
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

    const { getSteadfastStatusByConsignmentId, mapSteadfastStatusToOrderStatus } =
      await import("@/lib/steadfast.server");
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
