import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteOrder, getOrder, updateOrder } from "@/lib/admin.functions";
import { formatBDT } from "@/lib/products";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";
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
                    <td className="p-3">
                      {it.name}
                      <div className="text-xs text-muted-foreground">
                        {formatBDT(Number(it.price))} × {it.quantity}
                      </div>
                    </td>
                    <td className="p-3 text-right font-medium">
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
