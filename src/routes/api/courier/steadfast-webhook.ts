import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/courier/steadfast-webhook
 *
 * Steadfast panel → Webhook Integration-এ:
 *   Callback Url:      https://yourdomain.com/api/courier/steadfast-webhook
 *   Auth Token (Bearer): STEADFAST_WEBHOOK_TOKEN secret-এর একই মান বসান
 *
 * দুই ধরনের notification আসতে পারে (notification_type ফিল্ড দিয়ে আলাদা করা যায়):
 *   - "delivery_status": consignment_id, invoice, status, cod_amount,
 *                         delivery_charge, tracking_message, updated_at
 *   - "tracking_update":  consignment_id, invoice, tracking_message, updated_at
 *                         (কোনো status field নেই — শুধু log করা হয়)
 *
 * Steadfast আশা করে HTTP 200 + {"status":"success","message":"..."} — এই শেপেই
 * response দিতে হবে, নাহলে retry করতে থাকবে।
 */
export const Route = createFileRoute("/api/courier/steadfast-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const jsonResponse = (status: number, body: { status: "success" | "error"; message: string }) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          });

        const { verifySteadfastWebhookToken, mapSteadfastStatusToOrderStatus } = await import(
          "@/lib/steadfast.server"
        );

        const authHeader = request.headers.get("authorization");
        if (!verifySteadfastWebhookToken(authHeader)) {
          return jsonResponse(401, { status: "error", message: "Unauthorized" });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return jsonResponse(400, { status: "error", message: "Invalid JSON" });
        }

        const notificationType: string | undefined = payload?.notification_type;
        const consignmentId = payload?.consignment_id ? String(payload.consignment_id) : null;
        const invoice: string | null = payload?.invoice ?? null;

        if (!consignmentId && !invoice) {
          return jsonResponse(400, { status: "error", message: "Invalid consignment ID." });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let query = supabaseAdmin.from("orders").select("id").limit(1);
        query = consignmentId
          ? query.eq("courier_consignment_id", consignmentId)
          : query.eq("order_no", invoice as string);
        const { data: order, error } = await query.maybeSingle();

        if (error) {
          console.error("[steadfast-webhook] order lookup failed:", error.message);
          return jsonResponse(500, { status: "error", message: "Lookup failed." });
        }
        if (!order) {
          // আমাদের কোনো order নয় (বা মুছে ফেলা হয়েছে) — তবু 200 দিয়ে দিচ্ছি যাতে
          // Steadfast বারবার retry না করে।
          return jsonResponse(200, { status: "success", message: "Acknowledged (no matching order)." });
        }

        // tracking_update-এ status field থাকে না, শুধু tracking_message — শুধু log করি,
        // order status পরিবর্তন করি না।
        if (notificationType === "tracking_update") {
          console.log(
            `[steadfast-webhook] tracking update for order ${order.id}:`,
            payload?.tracking_message,
          );
          return jsonResponse(200, { status: "success", message: "Webhook received successfully." });
        }

        const deliveryStatus: string | undefined = payload?.status;
        if (!deliveryStatus) {
          return jsonResponse(400, { status: "error", message: "Missing status." });
        }

        const patch: Record<string, unknown> = {
          courier_status: deliveryStatus,
          courier_last_synced_at: new Date().toISOString(),
        };
        const mappedStatus = mapSteadfastStatusToOrderStatus(deliveryStatus);
        if (mappedStatus) patch.status = mappedStatus;

        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update(patch)
          .eq("id", order.id);
        if (updateError) {
          console.error("[steadfast-webhook] update failed:", updateError.message);
          return jsonResponse(500, { status: "error", message: "Update failed." });
        }
        if (mappedStatus) {
          await supabaseAdmin
            .from("order_status_history")
            .insert({ order_id: order.id, status: mappedStatus });
        }

        return jsonResponse(200, { status: "success", message: "Webhook received successfully." });
      },
    },
  },
});