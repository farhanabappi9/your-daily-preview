import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteCoupon, listCoupons, saveCoupon } from "@/lib/admin.functions";
import { formatBDT } from "@/lib/products";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/coupons")({ component: CouponsPage });

const blank = { code: "", type: "percent", value: 10, min_order: 0, expires_at: "", active: true };

function CouponsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-coupons"], queryFn: () => listCoupons() });
  const [edit, setEdit] = useState<any>(null);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await saveCoupon({
        data: {
          id: edit.id,
          code: edit.code,
          type: edit.type,
          value: Number(edit.value),
          min_order: Number(edit.min_order) || 0,
          expires_at: edit.expires_at || null,
          active: !!edit.active,
        },
      });
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Coupons</h1>
        <button
          onClick={() => setEdit({ ...blank })}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> নতুন কুপন
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Discount</th>
              <th className="hidden p-3 sm:table-cell">Min order</th>
              <th className="hidden p-3 md:table-cell">Expires</th>
              <th className="hidden p-3 lg:table-cell">Used</th>
              <th className="p-3">Active</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {((data ?? []) as any[]).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-mono font-medium">{c.code}</td>
                <td className="p-3">
                  {c.type === "percent" ? `${c.value}%` : formatBDT(Number(c.value))}
                </td>
                <td className="hidden p-3 sm:table-cell">{formatBDT(Number(c.min_order))}</td>
                <td className="hidden p-3 text-xs md:table-cell">
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-GB") : "—"}
                </td>
                <td className="hidden p-3 lg:table-cell">{c.used_count ?? 0}</td>
                <td className="p-3">{c.active ? "✅" : "—"}</td>
                <td className="p-3">
                  <div className="flex gap-3 text-xs">
                    <button
                      onClick={() =>
                        setEdit({ ...c, expires_at: c.expires_at?.slice(0, 10) ?? "" })
                      }
                      className="text-primary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("কুপন মুছবেন?")) return;
                        await deleteCoupon({ data: { id: c.id } });
                        qc.invalidateQueries({ queryKey: ["admin-coupons"] });
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  কোনো কুপন নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEdit(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="w-full max-w-sm space-y-3 rounded-lg border bg-card p-5"
          >
            <h2 className="font-semibold">{edit.id ? "Edit coupon" : "নতুন কুপন"}</h2>
            <input
              required
              placeholder="CODE"
              value={edit.code}
              onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
              className="input font-mono"
            />
            <select
              value={edit.type}
              onChange={(e) => setEdit({ ...edit, type: e.target.value })}
              className="input"
            >
              <option value="percent">Percent (%)</option>
              <option value="flat">Flat (৳)</option>
            </select>
            <input
              type="number"
              required
              placeholder="Value"
              value={edit.value}
              onChange={(e) => setEdit({ ...edit, value: e.target.value })}
              className="input"
            />
            <input
              type="number"
              placeholder="Min order"
              value={edit.min_order}
              onChange={(e) => setEdit({ ...edit, min_order: e.target.value })}
              className="input"
            />
            <input
              type="date"
              value={edit.expires_at ?? ""}
              onChange={(e) => setEdit({ ...edit, expires_at: e.target.value })}
              className="input"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />{" "}
              Active
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-md border px-4 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
