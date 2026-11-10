import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listOrders } from "@/lib/admin.functions";
import { bulkSendOrdersToCourier } from "@/lib/courier.functions";
import { formatBDT } from "@/lib/products";
import { Download, Printer, Truck } from "lucide-react";
import { ORDER_SOURCES, SOURCE_LABEL, sourceKey, type OrderSource } from "@/lib/order-source";
import { SourceBadge } from "@/components/admin/SourceBadge";
import { computeCodAmount } from "@/lib/cod";

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

type SourceFilter = "all" | OrderSource | "unknown";

const DATE_RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "all", label: "সব সময়", days: null },
  { key: "today", label: "আজ", days: 0 },
  { key: "3", label: "শেষ ৩ দিন", days: 3 },
  { key: "5", label: "শেষ ৫ দিন", days: 5 },
  { key: "7", label: "শেষ ৭ দিন", days: 7 },
  { key: "30", label: "শেষ ৩০ দিন", days: 30 },
];

function rangeStart(days: number | null): number {
  if (days === null) return 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

/** Excel-এ বাংলা ঠিকমতো দেখাতে BOM সহ CSV। */
function downloadCsv(rows: any[], filename: string) {
  const header = [
    "Order No",
    "Date",
    "Source",
    "Ad?",
    "Campaign",
    "Customer",
    "Phone",
    "Address",
    "Items",
    "Subtotal",
    "Delivery",
    "Discount",
    "Total",
    "COD (Steadfast)",
    "Status",
    "Courier",
  ];
  const esc = (v: unknown) => {
    const t = String(v ?? "");
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = rows.map((o) =>
    [
      o.order_no,
      new Date(o.created_at).toLocaleString("en-GB"),
      SOURCE_LABEL[sourceKey(o.source)],
      o.source_medium === "paid" ? "Yes" : "",
      o.attribution?.utm_campaign ?? "",
      o.customer_name,
      o.phone,
      o.address,
      (o.order_items ?? []).map((i: any) => `${i.name} x${i.quantity}`).join("; "),
      o.subtotal,
      o.shipping,
      o.discount,
      o.total,
      computeCodAmount(o),
      o.status,
      o.courier_tracking_code ?? "",
    ]
      .map(esc)
      .join(","),
  );
  const csv = "\ufeff" + [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
  const [source, setSource] = useState<SourceFilter>("all");
  const [range, setRange] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  // তারিখ + সার্চ ফিল্টার করা অর্ডার (সোর্স ফিল্টারের আগে) — সোর্স-ভিত্তিক গণনার জন্য
  const baseRows = useMemo(() => {
    const all = (data ?? []) as any[];
    const from = rangeStart(DATE_RANGES.find((r) => r.key === range)?.days ?? null);
    const t = q.trim().toLowerCase();
    return all.filter((o) => {
      const okStatus = status === "all" || o.status === status;
      const okDate = !from || new Date(o.created_at).getTime() >= from;
      const okQ =
        !t ||
        o.order_no?.toLowerCase().includes(t) ||
        o.customer_name?.toLowerCase().includes(t) ||
        o.phone?.includes(t);
      return okStatus && okDate && okQ;
    });
  }, [data, q, status, range]);

  const rows = useMemo(
    () => baseRows.filter((o) => source === "all" || sourceKey(o.source) === source),
    [baseRows, source],
  );

  const sourceCounts = useMemo(() => {
    const counts: Record<string, { n: number; value: number }> = {};
    for (const o of baseRows) {
      const k = sourceKey(o.source);
      counts[k] = counts[k] ?? { n: 0, value: 0 };
      counts[k].n += 1;
      counts[k].value += Number(o.total) || 0;
    }
    return counts;
  }, [baseRows]);

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
      const failedList = res.results
        .filter((r) => r.status === "error")
        .map((r) => `${r.invoice}: ${r.error}`)
        .join(" | ");
      setBulkMsg(
        `পাঠানো হয়েছে: ${res.sent}, ব্যর্থ: ${res.failed}, আগেই পাঠানো ছিল: ${res.alreadySent}` +
          (failedList ? ` — ${failedList}` : ""),
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
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {DATE_RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as SourceFilter)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="all">সব সোর্স</option>
          {[...ORDER_SOURCES, "unknown" as const].map((k) => (
            <option key={k} value={k}>
              {SOURCE_LABEL[k]}
            </option>
          ))}
        </select>
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

      {/* সোর্স অনুযায়ী অর্ডার সংখ্যা — ক্লিক করলে শুধু ওই সোর্সের অর্ডার দেখাবে */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSource("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${source === "all" ? "border-primary bg-primary/10" : ""}`}
        >
          সব · {baseRows.length}
        </button>
        {[...ORDER_SOURCES, "unknown" as const]
          .filter((k) => sourceCounts[k]?.n)
          .map((k) => (
            <button
              key={k}
              onClick={() => setSource(k)}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${source === k ? "border-primary bg-primary/10" : ""}`}
            >
              <SourceBadge source={k === "unknown" ? null : k} />
              <span className="font-semibold">{sourceCounts[k].n}</span>
              <span className="text-muted-foreground">· {formatBDT(sourceCounts[k].value)}</span>
            </button>
          ))}
        <button
          onClick={() =>
            downloadCsv(
              rows,
              `orders-${source}-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
            )
          }
          disabled={rows.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> CSV ডাউনলোড ({rows.length})
        </button>
      </div>

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
              <th className="p-3">Source</th>
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
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
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
                  <SourceBadge source={o.source} medium={o.source_medium} />
                  {o.attribution?.utm_campaign && (
                    <div
                      className="mt-1 max-w-[140px] truncate text-[11px] text-muted-foreground"
                      title={o.attribution.utm_campaign}
                    >
                      {o.attribution.utm_campaign}
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
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
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
