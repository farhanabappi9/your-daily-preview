import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { deleteProduct, listAdminProducts, saveProduct } from "@/lib/admin.functions";
import { formatBDT } from "@/lib/products";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/products/")({ component: ProductsPage });

function ProductsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listAdminProducts(),
  });
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = (data ?? []) as any[];
    const t = q.trim().toLowerCase();
    return t ? all.filter((p) => p.name.toLowerCase().includes(t) || p.slug.includes(t)) : all;
  }, [data, q]);

  const toggle = async (p: any, patch: any) => {
    await saveProduct({
      data: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        name_en: p.name_en ?? "",
        price: Number(p.price),
        old_price: Number(p.old_price),
        stock: p.stock,
        category_slug: p.category_slug,
        images: p.images ?? [],
        description: p.description ?? "",
        badge: p.badge,
        active: p.active,
        featured: p.featured,
        sort_order: p.sort_order ?? 0,
        ...patch,
      },
    });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["storefront"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Products ({rows.length})</h1>
        <Link
          to="/admin/products/$id"
          params={{ id: "new" }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> নতুন প্রোডাক্ট
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="প্রোডাক্ট খুঁজুন"
        className="w-full rounded-md border px-3 py-2 text-sm sm:max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Price</th>
              <th className="p-3">Active</th>
              <th className="hidden p-3 sm:table-cell">Featured</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  লোড হচ্ছে…
                </td>
              </tr>
            )}
            {rows.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.images?.[0]}
                      alt=""
                      className="h-14 w-11 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0">
                      <Link
                        to="/admin/products/$id"
                        params={{ id: p.id }}
                        className="line-clamp-1 font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.category_slug}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">{formatBDT(Number(p.price))}</td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={p.active}
                    onChange={(e) => toggle(p, { active: e.target.checked })}
                  />
                </td>
                <td className="hidden p-3 sm:table-cell">
                  <input
                    type="checkbox"
                    checked={p.featured}
                    onChange={(e) => toggle(p, { featured: e.target.checked })}
                  />
                </td>
                <td className="p-3">
                  <button
                    onClick={async () => {
                      if (!confirm("প্রোডাক্টটি মুছে ফেলবেন?")) return;
                      await deleteProduct({ data: { id: p.id } });
                      qc.invalidateQueries({ queryKey: ["admin-products"] });
                      qc.invalidateQueries({ queryKey: ["storefront"] });
                    }}
                    className="text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
