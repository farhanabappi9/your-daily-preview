import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listOrders } from "@/lib/admin.functions";
import { formatBDT } from "@/lib/products";
import { Download } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({ component: ReportsPage });

const iso = (d: Date) => d.toISOString().slice(0, 10);

function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-orders"], queryFn: () => listOrders() });
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));

  const rows = useMemo(() => {
    const start = new Date(from + "T00:00:00").getTime();
    const end = new Date(to + "T23:59:59").getTime();
    return ((data ?? []) as any[]).filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= start && t <= end;
    });
  }, [data, from, to]);

  const valid = rows.filter((o) => o.status !== "cancelled" && o.status !== "returned");
  const revenue = valid.reduce((s, o) => s + Number(o.total), 0);
  const delivered = rows.filter((o) => o.status === "delivered").length;
  const cancelled = rows.filter((o) => o.status === "cancelled" || o.status === "returned").length;
  const avg = valid.length ? revenue / valid.length : 0;

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    valid.forEach((o) => {
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      map.set(k, (map.get(k) ?? 0) + Number(o.total));
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [valid]);
  const peak = Math.max(1, ...byDay.map(([, v]) => v));

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    valid.forEach((o) =>
      (o.order_items ?? []).forEach((it: any) => {
        const e = map.get(it.name) ?? { name: it.name, qty: 0, total: 0 };
        e.qty += it.quantity;
        e.total += it.quantity * Number(it.price);
        map.set(it.name, e);
      }),
    );
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [valid]);

  const exportCsv = () => {
    const head = ["Order no", "Date", "Customer", "Phone", "Status", "Payment", "Total"];
    const body = rows.map((o) => [
      o.order_no,
      new Date(o.created_at).toLocaleString("en-GB"),
      o.customer_name,
      o.phone,
      o.status,
      o.payment_status,
      Number(o.total),
    ]);
    const csv = [head, ...body]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold sm:text-2xl">Reports</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
        >
          <Download className="h-4 w-4" /> CSV export
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="বিক্রি" value={formatBDT(revenue)} />
        <Stat label="অর্ডার" value={String(rows.length)} />
        <Stat label="ডেলিভারড" value={String(delivered)} />
        <Stat label="গড় অর্ডার ভ্যালু" value={formatBDT(Math.round(avg))} />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-4 font-semibold">দৈনিক বিক্রি</h2>
        {byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">এই সময়ে কোন অর্ডার নেই।</p>
        ) : (
          <div className="flex h-40 items-end gap-1 overflow-x-auto">
            {byDay.map(([d, v]) => (
              <div key={d} className="flex min-w-[14px] flex-1 flex-col items-center gap-1">
                <div
                  title={`${d}: ${formatBDT(v)}`}
                  className="w-full rounded-t bg-primary"
                  style={{ height: `${Math.max(4, (v / peak) * 130)}px` }}
                />
                <span className="text-[9px] text-muted-foreground">{d.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <h2 className="border-b p-4 font-semibold">টপ প্রোডাক্ট</h2>
        <table className="w-full text-sm">
          <tbody>
            {topProducts.map((p) => (
              <tr key={p.name} className="border-b last:border-0">
                <td className="p-3">{p.name}</td>
                <td className="p-3 text-right text-muted-foreground">{p.qty} pcs</td>
                <td className="p-3 text-right font-medium">{formatBDT(p.total)}</td>
              </tr>
            ))}
            {topProducts.length === 0 && (
              <tr>
                <td className="p-4 text-sm text-muted-foreground">কোন ডেটা নেই।</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        বাতিল/রিটার্ন হওয়া {cancelled} টি অর্ডার বিক্রির হিসাব থেকে বাদ দেওয়া হয়েছে।
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
