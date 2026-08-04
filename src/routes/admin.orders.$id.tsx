import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteOrder, getOrder, updateOrder } from "@/lib/admin.functions";
import { sendOrderToCourier, refreshCourierStatus } from "@/lib/courier.functions";
import { formatBDT } from "@/lib/products";
import { ArrowLeft, Printer, Trash2, Truck, RefreshCw, X } from "lucide-react";
import { STATUSES } from "./admin.orders.index";

export const Route = createFileRoute("/admin/orders/$id")({ component: OrderDetail });

function OrderDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => getOrder({ data: { id } }),
  });
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [courierBusy, setCourierBusy] = useState(false);
  const [courierMsg, setCourierMsg] = useState<string | null>(null);
  // ছবি বড় করে দেখার জন্য lightbox state
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>;
  const order: any = data?.order;
  if (!order) return <p className="text-sm text-muted-foreground">Order পাওয়া যায়নি।</p>;

  const patch = async (p: any) => {
    setSaving(true);
    try {
      await updateOrder({ data: { id, ...p } });
      await qc.invalidateQueries({ queryKey: ["admin-order", id] });
      await qc.invalidateQueries({ queryKey: ["admin-orders"] });
      await qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } finally {
      setSaving(false);
    }
  };

  const sendToCourier = async () => {
    setCourierBusy(true);
    setCourierMsg(null);
    try {
      const res = await sendOrderToCourier({ data: { id } });
      setCourierMsg(res.ok ? "Steadfast-এ পাঠানো হয়েছে।" : res.error);
      await qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) {
      setCourierMsg(String(e?.message ?? e));
    } finally {
      setCourierBusy(false);
    }
  };

  const refreshStatus = async () => {
    setCourierBusy(true);
    setCourierMsg(null);
    try {
      const res = await refreshCourierStatus({ data: { id } });
      setCourierMsg(`Delivery status: ${res.delivery_status}`);
      await qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) {
      setCourierMsg(String(e?.message ?? e));
    } finally {
      setCourierBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/orders"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Orders
        </Link>
        <div className="flex gap-2">
          <Link
            to="/admin/invoice/$id"
            params={{ id }}
            target="_blank"
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Printer className="h-4 w-4" /> Invoice
          </Link>
          <button
            onClick={async () => {
              if (!confirm("এই অর্ডারটি মুছে ফেলবেন?")) return;
              await deleteOrder({ data: { id } });
              qc.invalidateQueries({ queryKey: ["admin-orders"] });
              navigate({ to: "/admin/orders" });
            }}
            className="flex items-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold">{order.order_no}</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border bg-card">
            <h2 className="border-b p-4 font-semibold">Items</h2>
            <table className="w-full text-sm">
              <tbody>
                {order.order_items?.map((it: any) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="w-[128px] p-3">
                      {it.image ? (
                        <button
                          type="button"
                          onClick={() => setZoom({ src: it.image, alt: it.name })}
                          title="বড় করে দেখতে ক্লিক করুন"
                          className="block overflow-hidden rounded-md border transition hover:opacity-90"
                        >
                          <img
                            src={it.image}
                            alt={it.name}
                            loading="lazy"
                            decoding="async"
                            className="h-28 w-28 object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-28 w-28 items-center justify-center rounded-md border bg-muted text-[11px] text-muted-foreground">
                          No image
                        </div>
                      )}
                    </td>
                    <td className="p-3 align-middle">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBDT(Number(it.price))} × {it.quantity}
                      </div>
                    </td>
                    <td className="p-3 text-right align-middle font-medium">
                      {formatBDT(Number(it.price) * it.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t p-4 text-sm">
              <Row label="Subtotal" value={formatBDT(Number(order.subtotal))} />
              {Number(order.discount) > 0 && (
                <Row label="Discount" value={"-" + formatBDT(Number(order.discount))} />
              )}
              <Row label="Delivery" value={formatBDT(Number(order.shipping))} />
              <Row label="Total" value={formatBDT(Number(order.total))} bold />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 font-semibold">Status history</h2>
            <ul className="space-y-2 text-sm">
              {data?.history?.map((h: any) => (
                <li key={h.id} className="flex justify-between border-b pb-1 last:border-0">
                  <span>{h.status}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("en-GB")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 text-sm">
            <h2 className="mb-3 font-semibold">Customer</h2>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-muted-foreground">{order.phone}</p>
            <p className="mt-2 whitespace-pre-line text-muted-foreground">{order.address}</p>
            {order.note && <p className="mt-2 rounded bg-muted p-2 text-xs">📝 {order.note}</p>}
          </div>

          <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
            <h2 className="font-semibold">Courier — Steadfast</h2>
            {order.courier_consignment_id ? (
              <div className="space-y-1 text-xs">
                <p>
                  <span className="text-muted-foreground">Consignment ID:</span>{" "}
                  {order.courier_consignment_id}
                </p>
                <p>
                  <span className="text-muted-foreground">Tracking code:</span>{" "}
                  {order.courier_tracking_code}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {order.courier_status ?? "pending"}
                  </span>
                </p>
                <button
                  onClick={refreshStatus}
                  disabled={courierBusy}
                  className="mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Status Refresh করুন
                </button>
              </div>
            ) : (
              <button
                onClick={sendToCourier}
                disabled={courierBusy}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Truck className="h-4 w-4" /> Send to Steadfast
              </button>
            )}
            {order.courier_error && !order.courier_consignment_id && (
              <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                {order.courier_error}
              </p>
            )}
            {courierMsg && <p className="text-xs text-muted-foreground">{courierMsg}</p>}
          </div>

          <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
            <h2 className="font-semibold">Manage</h2>
            <label className="block text-xs text-muted-foreground">Order status</label>
            <select
              value={order.status}
              disabled={saving}
              onChange={(e) => patch({ status: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <label className="block text-xs text-muted-foreground">Payment status</label>
            <select
              value={order.payment_status}
              disabled={saving}
              onChange={(e) => patch({ payment_status: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {["unpaid", "paid", "refunded"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <label className="block text-xs text-muted-foreground">Courier / tracking note</label>
            <input
              defaultValue={order.tracking_note ?? ""}
              onBlur={(e) => patch({ tracking_note: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />

            <label className="block text-xs text-muted-foreground">Admin note</label>
            <textarea
              defaultValue={order.admin_note ?? ""}
              onBlur={(e) => patch({ admin_note: e.target.value })}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </div>
        </div>
      </div>

      {/* ছবি বড় করে দেখার lightbox */}
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-card p-2 text-foreground shadow"
          >
            <X className="h-5 w-5" />
          </button>
          <figure onClick={(e) => e.stopPropagation()} className="max-h-full max-w-3xl">
            <img
              src={zoom.src}
              alt={zoom.alt}
              className="max-h-[80vh] w-auto rounded-lg object-contain shadow-2xl"
            />
            <figcaption className="mt-3 text-center text-sm text-white">{zoom.alt}</figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
