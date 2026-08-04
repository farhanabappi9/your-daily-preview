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
  total: number | string;
  payment_method: string;
  courier_consignment_id: string | null;
};

function buildSteadfastPayload(order: OrderForCourier) {
  const codAmount = order.payment_method === "cod" ? Number(order.total) : 0;
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
      .select("id, order_no, customer_name, phone, address, note, total, payment_method, courier_consignment_id")
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
      .select("id, order_no, customer_name, phone, address, note, total, payment_method, courier_consignment_id")
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