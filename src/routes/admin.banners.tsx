import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteBanner, listBanners, saveBanner } from "@/lib/admin.functions";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/banners")({ component: BannersPage });

const blank = { image: "", title: "", subtitle: "", link: "", sort_order: 0, active: true };

function BannersPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-banners"], queryFn: () => listBanners() });
  const [edit, setEdit] = useState<any>(null);
  const [error, setError] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["storefront"] });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!edit.image) return setError("একটি ছবি দিন।");
    try {
      await saveBanner({
        data: {
          id: edit.id,
          image: edit.image,
          title: edit.title || null,
          subtitle: edit.subtitle || null,
          link: edit.link || null,
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Hero banners</h1>
        <button
          onClick={() => setEdit({ ...blank })}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> নতুন ব্যানার
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {((data ?? []) as any[]).map((b) => (
          <div key={b.id} className="overflow-hidden rounded-lg border bg-card">
            <img src={b.image} alt="" className="h-40 w-full object-cover" />
            <div className="space-y-1 p-3">
              <p className="font-medium">{b.title || "—"}</p>
              <p className="text-xs text-muted-foreground">{b.subtitle}</p>
              <div className="flex gap-3 pt-2 text-xs">
                <button onClick={() => setEdit({ ...b })} className="text-primary">
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("ব্যানার মুছবেন?")) return;
                    await deleteBanner({ data: { id: b.id } });
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
        {(data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            কোনো ব্যানার নেই — ডিফল্ট hero দেখানো হচ্ছে।
          </p>
        )}
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
            <h2 className="font-semibold">{edit.id ? "Edit banner" : "নতুন ব্যানার"}</h2>
            <ImageUploader
              images={edit.image ? [edit.image] : []}
              max={1}
              onChange={(imgs) => setEdit({ ...edit, image: imgs[0] ?? "" })}
            />
            <input
              placeholder="Title"
              value={edit.title ?? ""}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              className="input"
            />
            <input
              placeholder="Subtitle"
              value={edit.subtitle ?? ""}
              onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })}
              className="input"
            />
            <input
              placeholder="Link (যেমন /shop)"
              value={edit.link ?? ""}
              onChange={(e) => setEdit({ ...edit, link: e.target.value })}
              className="input"
            />
            <input
              type="number"
              placeholder="Sort order"
              value={edit.sort_order}
              onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })}
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
