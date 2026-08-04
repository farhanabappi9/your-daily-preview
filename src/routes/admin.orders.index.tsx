import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listOrders } from "@/lib/admin.functions";
import { bulkSendOrdersToCourier } from "@/lib/courier.functions";
import { formatBDT } from "@/lib/products";
import { Printer, Truck } from "lucide-react";

export const Route = createFileRoute("/admin/orders/")({ component: OrdersPage });

export const STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

/** Order row-এর প্রোডাক্ট ছবিগুলো (বড় thumbnail, hover করলে আরও বড় preview) */
function OrderItemThumbs({ items }: { items: any[] }) {
  const list = (items ?? []).filter((i) => i?.image);
  if (list.length === 0) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
        No image
      </div>
    );
  }
  const shown = list.slice(0, 3);
  return (
    <div className="flex items-center gap-1.5">
      {shown.map((it: any, idx: number) => (
        <div key={it.id ?? idx} className="group relative">
          <img
            src={it.image}
            alt={it.name}
            loading="lazy"
            decoding="async"
            className="h-16 w-16 rounded-md border object-cover"
          />
          {/* hover preview */}
          <div className="pointer-events-none absolute left-0 top-full z-30 hidden pt-2 group-hover:block">
            <img
              src={it.image}
              alt={it.name}
              className="h-64 w-64 rounded-lg border bg-card object-cover shadow-xl"
            />
          </div>
        </div>
      ))}
      {list.length > shown.length && (
        <span className="text-xs text-muted-foreground">+{list.length - shown.length}</span>
      )}
    </div>
  );
}

function OrdersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-orders"], queryFn: () => listOrders() });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = (data ?? []) as any[];
    return all.filter((o) => {
      const okStatus = status === "all" || o.status === status;
      const t = q.trim().toLowerCase();
      const okQ =
        !t ||
        o.order_no?.toLowerCase().includes(t) ||
        o.customer_name?.toLowerCase().includes(t) ||
        o.phone?.includes(t);
      return okStatus && okQ;
    });
  }, [data, q, status]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  };

  const bulkSend = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const res = await bulkSendOrdersToCourier({ data: { ids: Array.from(selected) } });
      setBulkMsg(
        `পাঠানো হয়েছে: ${res.sent}, ব্যর্থ: ${res.failed}, আগেই পাঠানো ছিল: ${res.alreadySent}`,
      );
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      setBulkMsg(String(e?.message ?? e));
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold sm:text-2xl">Orders</h1>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Order no / নাম / ফোন খুঁজুন"
          className="min-w-0 flex-1 basis-full sm:basis-auto rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="all">সব status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {selected.size > 0 && (
          <button
            onClick={bulkSend}
            disabled={bulkBusy}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Truck className="h-4 w-4" /> Steadfast-এ পাঠান ({selected.size})
          </button>
        )}
      </div>
      {bulkMsg && <p className="text-xs text-muted-foreground">{bulkMsg}</p>}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="p-3">Product</th>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="hidden p-3 sm:table-cell">Items</th>
              <th className="p-3">Total</th>
              <th className="hidden p-3 lg:table-cell">Payment</th>
              <th className="p-3">Status</th>
              <th className="hidden p-3 md:table-cell">Date</th>
              <th className="p-3 text-right">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-muted-foreground">
                  লোড হচ্ছে…
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr key={o.id} className="border-t hover:bg-muted/40">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggleOne(o.id)}
                  />
                </td>
                <td className="p-3">
                  <Link to="/admin/orders/$id" params={{ id: o.id }}>
                    <OrderItemThumbs items={o.order_items ?? []} />
                  </Link>
                </td>
                <td className="p-3">
                  <Link
                    to="/admin/orders/$id"
                    params={{ id: o.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {o.order_no}
                  </Link>
                  {o.courier_consignment_id && (
                    <div className="text-[11px] text-muted-foreground">
                      📦 {o.courier_status ?? "pending"}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <span className="line-clamp-1">{o.customer_name}</span>
                  <div className="text-xs text-muted-foreground">{o.phone}</div>
                  <div className="text-[11px] text-muted-foreground md:hidden">
                    {new Date(o.created_at).toLocaleDateString("en-GB")}
                  </div>
                </td>
                <td className="hidden p-3 sm:table-cell">{o.order_items?.length ?? 0}</td>
                <td className="p-3">{formatBDT(Number(o.total))}</td>
                <td className="hidden p-3 text-xs lg:table-cell">
                  {o.payment_method} · {o.payment_status}
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                    {o.status}
                  </span>
                </td>
                <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">
                  {new Date(o.created_at).toLocaleString("en-GB")}
                </td>
                <td className="p-3 text-right">
                  <Link
                    to="/admin/invoice/$id"
                    params={{ id: o.id }}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
                  >
                    <Printer className="h-3.5 w-3.5" /> Invoice
                  </Link>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-muted-foreground">
                  কোনো অর্ডার পাওয়া যায়নি।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
