import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteAdminCategories,
  listAdminCategories,
  saveAdminCategory,
} from "@/lib/admin-categories.functions";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/categories")({ component: CategoriesPage });

type CatForm = {
  id?: string;
  slug: string;
  name: string;
  name_en: string;
  image: string;
  description: string;
  description_en: string;
  sort_order: number;
  active: boolean;
};

const blank: CatForm = {
  slug: "",
  name: "",
  name_en: "",
  image: "",
  description: "",
  description_en: "",
  sort_order: 0,
  active: true,
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function CategoriesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => listAdminCategories(),
  });
  const categories = data?.categories ?? [];
  const counts = data?.counts ?? {};

  const [edit, setEdit] = useState<CatForm | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // সেভ/ডিলিটের পর অ্যাডমিন লিস্ট + ওয়েবসাইটের ডেটা — দুটোই রিফ্রেশ
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-categories"] }),
      qc.invalidateQueries({ queryKey: ["storefront"] }),
      qc.invalidateQueries({ queryKey: ["admin-products"] }),
    ]);
  };

  const openNew = () => {
    const nextOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0) + 10;
    setSlugTouched(false);
    setError("");
    setEdit({ ...blank, sort_order: nextOrder });
  };

  const openEdit = (c: any) => {
    setSlugTouched(true);
    setError("");
    setEdit({
      id: c.id,
      slug: c.slug,
      name: c.name,
      name_en: c.name_en ?? "",
      image: c.image ?? "",
      description: c.description ?? "",
      description_en: c.description_en ?? "",
      sort_order: c.sort_order ?? 0,
      active: !!c.active,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setError("");
    setSaving(true);
    try {
      await saveAdminCategory({
        data: {
          id: edit.id,
          slug: edit.slug,
          name: edit.name,
          name_en: edit.name_en,
          image: edit.image || null,
          description: edit.description,
          description_en: edit.description_en,
          sort_order: Number(edit.sort_order) || 0,
          active: edit.active,
        },
      });
      setEdit(null);
      setNotice(edit.id ? "ক্যাটাগরি আপডেট হয়েছে ✅" : "নতুন ক্যাটাগরি তৈরি হয়েছে — ওয়েবসাইটে লাইভ ✅");
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: any) => {
    setNotice("");
    try {
      await saveAdminCategory({
        data: {
          id: c.id,
          slug: c.slug,
          name: c.name,
          name_en: c.name_en ?? "",
          image: c.image ?? null,
          description: c.description ?? "",
          description_en: c.description_en ?? "",
          sort_order: c.sort_order ?? 0,
          active: !c.active,
        },
      });
      await refresh();
    } catch (err: any) {
      setNotice(err?.message ?? "আপডেট ব্যর্থ");
    }
  };

  const remove = async (ids: string[]) => {
    if (!ids.length) return;
    const affected = categories
      .filter((c) => ids.includes(c.id))
      .reduce((sum, c) => sum + (counts[c.slug] ?? 0), 0);
    const msg =
      `${ids.length}টি ক্যাটাগরি মুছবেন?` +
      (affected
        ? `\n\nএগুলোর ${affected}টি প্রোডাক্ট মুছবে না, তবে "ক্যাটাগরিবিহীন" হয়ে যাবে।`
        : "");
    if (!confirm(msg)) return;
    setBusy(true);
    setNotice("");
    try {
      await deleteAdminCategories({ data: { ids } });
      setSelected((s) => s.filter((id) => !ids.includes(id)));
      setNotice("ডিলিট হয়েছে ✅");
      await refresh();
    } catch (err: any) {
      setNotice(err?.message ?? "ডিলিট ব্যর্থ");
    } finally {
      setBusy(false);
    }
  };

  const allSelected = categories.length > 0 && selected.length === categories.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">
          Categories <span className="text-sm font-normal text-muted-foreground">({categories.length})</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {categories.length > 0 && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? [] : categories.map((c) => c.id))}
              />
              সব সিলেক্ট
            </label>
          )}
          {selected.length > 0 && (
            <button
              disabled={busy}
              onClick={() => remove(selected)}
              className="flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> সিলেক্টেড মুছুন ({selected.length})
            </button>
          )}
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> নতুন
          </button>
        </div>
      </div>

      {notice && (
        <p className="rounded-md border bg-card px-3 py-2 text-sm" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          ক্যাটাগরি লোড করা যায়নি: {(loadError as Error).message}
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <div
            key={c.id}
            className={`flex gap-3 rounded-lg border bg-card p-3 ${c.active ? "" : "opacity-70"}`}
          >
            <input
              type="checkbox"
              aria-label="select"
              checked={selected.includes(c.id)}
              onChange={() =>
                setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))
              }
              className="mt-1 h-4 w-4 shrink-0"
            />
            {c.image && <img src={c.image} alt="" className="h-16 w-14 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                /{c.slug} · {counts[c.slug] ?? 0} products · order {c.sort_order}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  c.active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}
              >
                {c.active ? "● ওয়েবসাইটে লাইভ" : "লুকানো (Inactive)"}
              </span>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <button onClick={() => openEdit(c)} className="text-primary">
                  Edit
                </button>
                <button onClick={() => toggleActive(c)} className="text-primary">
                  {c.active ? "Hide" : "Show"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => remove([c.id])}
                  className="flex items-center gap-1 text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && categories.length === 0 && !loadError && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          কোনো ক্যাটাগরি নেই। "নতুন" বাটনে ক্লিক করে তৈরি করুন।
        </p>
      )}

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setEdit(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="my-auto w-full max-w-md space-y-3 rounded-lg border bg-card p-5"
          >
            <h2 className="font-semibold">{edit.id ? "Edit category" : "নতুন category"}</h2>
            <input
              required
              placeholder="নাম (বাংলা)"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              className="input"
            />
            <input
              placeholder="Name (English)"
              value={edit.name_en}
              onChange={(e) => {
                const name_en = e.target.value;
                setEdit({
                  ...edit,
                  name_en,
                  slug: slugTouched ? edit.slug : slugify(name_en),
                });
              }}
              className="input"
            />
            <div>
              <input
                required
                placeholder="slug (ইংরেজি, যেমন: kids-wear)"
                value={edit.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setEdit({ ...edit, slug: slugify(e.target.value) });
                }}
                className="input"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                ওয়েবসাইট লিংক: /category/{edit.slug || "..."}
              </p>
            </div>
            <textarea
              placeholder="Description (বাংলা)"
              rows={2}
              value={edit.description}
              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              className="input"
            />
            <textarea
              placeholder="Description (English)"
              rows={2}
              value={edit.description_en}
              onChange={(e) => setEdit({ ...edit, description_en: e.target.value })}
              className="input"
            />
            <label className="block text-xs text-muted-foreground">
              ক্রম (ছোট সংখ্যা আগে দেখাবে)
              <input
                type="number"
                value={edit.sort_order}
                onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })}
                className="input mt-1"
              />
            </label>
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
              Active (ওয়েবসাইটে দেখাবে)
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button
                disabled={saving}
                className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
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
