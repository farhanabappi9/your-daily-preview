import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listOrders } from "@/lib/admin.functions";
import { formatBDT } from "@/lib/products";

export const Route = createFileRoute("/admin/customers")({ component: CustomersPage });

function CustomersPage() {
  const { data } = useQuery({ queryKey: ["admin-orders"], queryFn: () => listOrders() });
  const [q, setQ] = useState("");

  const customers = useMemo(() => {
    const map = new Map<string, any>();
    for (const o of (data ?? []) as any[]) {
      const key = o.phone;
      const c = map.get(key) ?? {
        phone: o.phone,
        name: o.customer_name,
        address: o.address,
        orders: 0,
        spent: 0,
        last: o.created_at,
      };
      c.orders += 1;
      if (o.status !== "cancelled" && o.status !== "returned") c.spent += Number(o.total);
      if (new Date(o.created_at) > new Date(c.last)) c.last = o.created_at;
      map.set(key, c);
    }
    const list = [...map.values()].sort((a, b) => b.spent - a.spent);
    const t = q.trim().toLowerCase();
    return t ? list.filter((c) => c.name?.toLowerCase().includes(t) || c.phone?.includes(t)) : list;
  }, [data, q]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold sm:text-2xl">Customers ({customers.length})</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="নাম / ফোন খুঁজুন"
        className="w-full rounded-md border px-3 py-2 text-sm sm:max-w-sm"
      />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Customer</th>
              <th className="hidden p-3 md:table-cell">Location</th>
              <th className="p-3">Orders</th>
              <th className="p-3">Total spent</th>
              <th className="hidden p-3 sm:table-cell">Last order</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.phone} className="border-t">
                <td className="p-3">
                  {c.name}
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                </td>
                <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">
                  {c.address}
                </td>
                <td className="p-3">{c.orders}</td>
                <td className="p-3 font-medium">{formatBDT(c.spent)}</td>
                <td className="hidden p-3 text-xs text-muted-foreground sm:table-cell">
                  {new Date(c.last).toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  এখনো কোনো কাস্টমার নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
