import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteCategory, saveCategory } from "@/lib/admin.functions";
import { getStorefront } from "@/lib/shop.functions";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/categories")({ component: CategoriesPage });

const blank = {
  slug: "",
  name: "",
  name_en: "",
  image: "",
  description: "",
  sort_order: 0,
  active: true,
};

function CategoriesPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["storefront"], queryFn: () => getStorefront() });
  const [edit, setEdit] = useState<any>(null);
  const [error, setError] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["storefront"] });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await saveCategory({
        data: {
          id: edit.id,
          slug: edit.slug,
          name: edit.name,
          name_en: edit.name_en ?? "",
          image: edit.image || null,
          description: edit.description ?? "",
          sort_order: Number(edit.sort_order) || 0,
          active: !!edit.active,
        },
      });
      setEdit(null);
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Categories</h1>
        <button
          onClick={() => setEdit({ ...blank })}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> নতুন
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.categories ?? []).map((c: any) => (
          <div key={c.id} className="flex gap-3 rounded-lg border bg-card p-3">
            {c.image && <img src={c.image} alt="" className="h-16 w-14 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">/{c.slug}</p>
              <div className="mt-2 flex gap-3 text-xs">
                <button
                  onClick={() => setEdit({ ...c, name_en: c.name_en ?? "", image: c.image ?? "" })}
                  className="text-primary"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("ক্যাটাগরি মুছবেন?")) return;
                    await deleteCategory({ data: { id: c.id } });
                    refresh();
                  }}
                  className="flex items-center gap-1 text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEdit(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="w-full max-w-md space-y-3 rounded-lg border bg-card p-5"
          >
            <h2 className="font-semibold">{edit.id ? "Edit category" : "নতুন category"}</h2>
            <input
              required
              placeholder="নাম"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              className="input"
            />
            <input
              placeholder="Name (English)"
              value={edit.name_en}
              onChange={(e) => setEdit({ ...edit, name_en: e.target.value })}
              className="input"
            />
            <input
              required
              placeholder="slug"
              value={edit.slug}
              onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
              className="input"
            />
            <textarea
              placeholder="Description"
              rows={3}
              value={edit.description ?? ""}
              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              className="input"
            />
            <ImageUploader
              images={edit.image ? [edit.image] : []}
              max={1}
              onChange={(imgs) => setEdit({ ...edit, image: imgs[0] ?? "" })}
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
