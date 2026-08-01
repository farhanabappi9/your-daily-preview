import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/admin.functions";
import { formatBDT } from "@/lib/products";
import { Package, ShoppingBag, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => getDashboard(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>;

  const orders = data?.orders ?? [];
  const products = data?.products ?? [];
  const valid = orders.filter((o: any) => o.status !== "cancelled" && o.status !== "returned");
  const revenue = valid.reduce((s: number, o: any) => s + Number(o.total), 0);
  const today = new Date().toDateString();
  const todayOrders = orders.filter((o: any) => new Date(o.created_at).toDateString() === today);
  const pending = orders.filter((o: any) => o.status === "pending").length;

  const byStatus = Object.keys(STATUS_LABEL).map((s) => ({
    status: s,
    count: orders.filter((o: any) => o.status === s).length,
  }));

  const topSold = Object.values(
    (data?.items ?? []).reduce((acc: any, it: any) => {
      acc[it.name] = acc[it.name] ?? { name: it.name, qty: 0, total: 0 };
      acc[it.name].qty += it.quantity;
      acc[it.name].total += it.quantity * Number(it.price);
      return acc;
    }, {}),
  )
    .sort((a: any, b: any) => b.qty - a.qty)
    .slice(0, 5) as any[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Wallet} label="মোট বিক্রি" value={formatBDT(revenue)} />
        <Stat icon={ShoppingBag} label="মোট অর্ডার" value={String(orders.length)} />
        <Stat icon={TrendingUp} label="আজকের অর্ডার" value={String(todayOrders.length)} />
        <Stat icon={Package} label="Pending" value={String(pending)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-semibold">Order status</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {byStatus.map((s) => (
              <div
                key={s.status}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <span>{STATUS_LABEL[s.status]}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-semibold">সবচেয়ে বেশি বিক্রি</h2>
          {topSold.length === 0 ? (
            <p className="text-sm text-muted-foreground">এখনো কোনো বিক্রি নেই।</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {topSold.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"
                >
                  <span className="line-clamp-1">{p.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {p.qty} pcs · {formatBDT(p.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">সাম্প্রতিক অর্ডার</h2>
          <Link to="/admin/orders" className="text-sm text-primary hover:underline">
            সব দেখুন
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((o: any) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3">
                    <Link
                      to="/admin/orders/$id"
                      params={{ id: o.id }}
                      className="text-primary hover:underline"
                    >
                      {o.order_no}
                    </Link>
                  </td>
                  <td className="p-3">
                    {o.customer_name}
                    <div className="text-xs text-muted-foreground">{o.phone}</div>
                  </td>
                  <td className="p-3">{formatBDT(Number(o.total))}</td>
                  <td className="p-3">{STATUS_LABEL[o.status]}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("en-GB")}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    এখনো কোনো অর্ডার নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
