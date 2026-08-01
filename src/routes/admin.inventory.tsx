import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAdminProducts, saveProduct } from "@/lib/admin.functions";
import { formatBDT } from "@/lib/products";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/inventory")({ component: InventoryPage });

const LOW = 5;

function InventoryPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listAdminProducts(),
  });
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "low" | "out">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ((data ?? []) as any[]).filter((p) => {
      const okQ = !t || p.name?.toLowerCase().includes(t) || p.slug?.toLowerCase().includes(t);
      const stock = Number(p.stock ?? 0);
      const okF = only === "all" || (only === "low" ? stock > 0 && stock <= LOW : stock <= 0);
      return okQ && okF;
    });
  }, [data, q, only]);

  const totalValue = ((data ?? []) as any[]).reduce(
    (s, p) => s + Number(p.price ?? 0) * Number(p.stock ?? 0),
    0,
  );

  const save = async (p: any, patch: any) => {
    setBusy(p.id);
    setMsg("");
    try {
      await saveProduct({
        data: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          name_en: p.name_en ?? "",
          price: Number(p.price ?? 0),
          old_price: Number(p.old_price ?? 0),
          stock: Number(p.stock ?? 0),
          category_slug: p.category_slug ?? null,
          images: p.images ?? [],
          description: p.description ?? "",
          badge: p.badge ?? null,
          active: !!p.active,
          featured: !!p.featured,
          sort_order: Number(p.sort_order ?? 0),
          ...patch,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin-products"] });
      await qc.invalidateQueries({ queryKey: ["storefront"] });
      setMsg("আপডেট হয়েছে ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Save failed");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold sm:text-2xl">Inventory</h1>
      <p className="text-sm text-muted-foreground">
        স্টক ভ্যালু: <span className="font-semibold text-foreground">{formatBDT(totalValue)}</span>
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="প্রোডাক্ট খুঁজুন"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={only}
          onChange={(e) => setOnly(e.target.value as any)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="all">সব</option>
          <option value="low">কম স্টক (≤ {LOW})</option>
          <option value="out">স্টক শেষ</option>
        </select>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3 w-32">Price (৳)</th>
              <th className="p-3 w-28">Stock</th>
              <th className="p-3 w-24">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const stock = Number(p.stock ?? 0);
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2 font-medium">
                      {stock <= LOW && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {p.name}
                    </div>
                    <span className="text-xs text-muted-foreground">{p.slug}</span>
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      defaultValue={Number(p.price ?? 0)}
                      disabled={busy === p.id}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== Number(p.price)) save(p, { price: v });
                      }}
                      className="w-24 rounded-md border px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      defaultValue={stock}
                      disabled={busy === p.id}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.floor(Number(e.target.value)));
                        if (v !== stock) save(p, { stock: v });
                      }}
                      className="w-20 rounded-md border px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={!!p.active}
                      disabled={busy === p.id}
                      onChange={(e) => save(p, { active: e.target.checked })}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-sm text-muted-foreground">
                  কোন প্রোডাক্ট নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
