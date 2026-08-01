import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAdminProducts, saveProduct, saveSettings } from "@/lib/admin.functions";
import { SizeManager } from "@/components/admin/SizeManager";
import type { SizeGroupConfig } from "@/lib/shop-types";
import { getStorefront } from "@/lib/shop.functions";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/products/$id")({ component: ProductEditor });

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function ProductEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const qc = useQueryClient();
  const navigate = useNavigate();

  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listAdminProducts(),
    enabled: !isNew,
  });
  const storeQuery = useQuery({ queryKey: ["storefront"], queryFn: () => getStorefront() });
  const existing = !isNew ? ((productsQuery.data ?? []) as any[]).find((p) => p.id === id) : null;

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [sizeGroups, setSizeGroups] = useState<SizeGroupConfig[] | null>(null);
  const [error, setError] = useState("");

  const state =
    form ??
    (isNew
      ? {
          slug: "",
          name: "",
          name_en: "",
          price: 0,
          old_price: 0,
          stock: 10,
          category_slug: "",
          images: [],
          description: "",
          badge: "",
          active: true,
          featured: false,
          sort_order: 0,
        }
      : existing
        ? {
            ...existing,
            name_en: existing.name_en ?? "",
            badge: existing.badge ?? "",
            description: existing.description ?? "",
            images: existing.images ?? [],
            category_slug: existing.category_slug ?? "",
            price: Number(existing.price),
            old_price: Number(existing.old_price),
          }
        : null);

  const savedSizeGroups: SizeGroupConfig[] =
    ((storeQuery.data?.settings as any)?.sizeConfig?.[id] as SizeGroupConfig[] | undefined) ?? [];

  if (!state) return <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>;

  const set = (patch: any) => setForm({ ...state, ...patch });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        id: isNew ? undefined : id,
        slug: state.slug || slugify(state.name),
        name: state.name,
        name_en: state.name_en,
        price: Number(state.price),
        old_price: Number(state.old_price) || Number(state.price),
        stock: Number(state.stock),
        category_slug: state.category_slug || null,
        images: state.images,
        description: state.description,
        badge: state.badge || null,
        active: !!state.active,
        featured: !!state.featured,
        sort_order: Number(state.sort_order) || 0,
      };
      const saved = await saveProduct({ data: payload });
      if (sizeGroups) {
        const current = storeQuery.data?.settings ?? ({} as any);
        const cfg: Record<string, SizeGroupConfig[]> = { ...(current.sizeConfig ?? {}) };
        const cleaned = sizeGroups.filter((g) => g.options.length > 0);
        if (cleaned.length) cfg[saved.id] = cleaned;
        else delete cfg[saved.id];
        await saveSettings({ data: { value: { ...current, sizeConfig: cfg } } });
      }
      await qc.invalidateQueries({ queryKey: ["admin-products"] });
      await qc.invalidateQueries({ queryKey: ["storefront"] });
      navigate({ to: "/admin/products" });
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const categories = storeQuery.data?.categories ?? [];

  return (
    <div className="space-y-4">
      <Link
        to="/admin/products"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>
      <h1 className="text-2xl font-bold">{isNew ? "নতুন প্রোডাক্ট" : "প্রোডাক্ট এডিট"}</h1>

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Basic">
            <Field label="নাম (বাংলা)">
              <input
                required
                value={state.name}
                onChange={(e) =>
                  set({ name: e.target.value, slug: isNew ? slugify(e.target.value) : state.slug })
                }
                className="input"
              />
            </Field>
            <Field label="Name (English)">
              <input
                value={state.name_en}
                onChange={(e) => set({ name_en: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Slug (URL)">
              <input
                required
                value={state.slug}
                onChange={(e) => set({ slug: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={8}
                value={state.description}
                onChange={(e) => set({ description: e.target.value })}
                className="input"
              />
            </Field>
          </Card>

          <Card title="সাইজ ম্যানেজমেন্ট (ছেলে / মেয়ে)">
            <p className="text-xs text-muted-foreground">
              গ্রুপ যোগ করুন, সাইজ লিখুন, আর তারকা চিহ্নে ক্লিক করে ডিফল্ট সাইজ ঠিক করুন। খালি রাখলে
              ক্যাটাগরি অনুযায়ী অটো সাইজ দেখাবে।
            </p>
            <SizeManager value={sizeGroups ?? savedSizeGroups} onChange={setSizeGroups} />
          </Card>

          <Card title="Images">
            <ImageUploader images={state.images} onChange={(images) => set({ images })} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Pricing">
            <Field label="Price (৳)">
              <input
                type="number"
                required
                value={state.price}
                onChange={(e) => set({ price: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Old price (৳)">
              <input
                type="number"
                value={state.old_price}
                onChange={(e) => set({ old_price: e.target.value })}
                className="input"
              />
            </Field>
          </Card>

          <Card title="Organization">
            <Field label="Category">
              <select
                value={state.category_slug}
                onChange={(e) => set({ category_slug: e.target.value })}
                className="input"
              >
                <option value="">— none —</option>
                {categories.map((c: any) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Badge (যেমন NEW / HOT)">
              <input
                value={state.badge}
                onChange={(e) => set({ badge: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={state.sort_order}
                onChange={(e) => set({ sort_order: e.target.value })}
                className="input"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.active}
                onChange={(e) => set({ active: e.target.checked })}
              />{" "}
              Active (ওয়েবসাইটে দেখাবে)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.featured}
                onChange={(e) => set({ featured: e.target.checked })}
              />{" "}
              Featured
            </label>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            disabled={saving}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "সেভ হচ্ছে…" : "Save product"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
