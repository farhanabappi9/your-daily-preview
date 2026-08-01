import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { saveSettings } from "@/lib/admin.functions";
import { getStorefront } from "@/lib/shop.functions";
import {
  DEFAULT_SETTINGS,
  contentSettings,
  invoiceSettings,
  type ShopSettings,
} from "@/lib/shop-types";
import { InvoiceDocument } from "@/components/InvoiceDocument";

export const Route = createFileRoute("/admin/content")({ component: ContentPage });

const SAMPLE: any = {
  id: "preview",
  order_no: "0001",
  customer_name: "মোঃ রাকিব হাসান",
  phone: "01700-000000",
  address: "বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা",
  area: "inside",
  subtotal: 3400,
  shipping: 80,
  discount: 200,
  total: 3280,
  payment_method: "COD",
  payment_status: "unpaid",
  status: "confirmed",
  created_at: new Date().toISOString(),
  order_items: [
    { id: "1", name: "Premium Cotton Panjabi (Size: XL)", price: 1700, quantity: 1 },
    { id: "2", name: "Silk Saree — Maroon", price: 1700, quantity: 1 },
  ],
};

function ContentPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["storefront"], queryFn: () => getStorefront() });
  const [form, setForm] = useState<ShopSettings | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const s: ShopSettings = form ?? { ...DEFAULT_SETTINGS, ...((data?.settings as any) ?? {}) };
  const inv = invoiceSettings(s);
  const content = contentSettings(s);
  const setInv = (patch: any) => setForm({ ...s, invoice: { ...inv, ...patch } });
  const setContent = (patch: any) => setForm({ ...s, content: { ...content, ...patch } });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await saveSettings({ data: { value: { ...s, invoice: inv, content } } });
      await qc.invalidateQueries({ queryKey: ["storefront"] });
      setMsg("সেভ হয়েছে ✅");
    } catch (err: any) {
      setMsg(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Content & Invoice</h1>
        <p className="text-sm text-muted-foreground">
          সাইটের লেখা, অ্যানাউন্সমেন্ট বার আর ইনভয়েসের সব তথ্য এখান থেকেই নিয়ন্ত্রণ করুন।
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form onSubmit={submit} className="space-y-4">
          <Card title="Announcement bar">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={content.announcementEnabled}
                onChange={(e) => setContent({ announcementEnabled: e.target.checked })}
              />
              সাইটের উপরে অ্যানাউন্সমেন্ট দেখান
            </label>
            <F label="Text">
              <input
                value={content.announcementText}
                onChange={(e) => setContent({ announcementText: e.target.value })}
                className="input"
              />
            </F>
            <F label="Link (optional)">
              <input
                value={content.announcementLink}
                onChange={(e) => setContent({ announcementLink: e.target.value })}
                className="input"
                placeholder="/shop"
              />
            </F>
          </Card>

          <Card title="Homepage & SEO">
            <F label="Hero title (ফাঁকা রাখলে ডিফল্ট)">
              <input
                value={content.heroTitle}
                onChange={(e) => setContent({ heroTitle: e.target.value })}
                className="input"
              />
            </F>
            <F label="Hero subtitle">
              <input
                value={content.heroSubtitle}
                onChange={(e) => setContent({ heroSubtitle: e.target.value })}
                className="input"
              />
            </F>
            <F label="Support hours">
              <input
                value={content.supportHours}
                onChange={(e) => setContent({ supportHours: e.target.value })}
                className="input"
              />
            </F>
            <F label="SEO title">
              <input
                value={content.seoTitle}
                onChange={(e) => setContent({ seoTitle: e.target.value })}
                className="input"
              />
            </F>
            <F label="SEO description">
              <textarea
                rows={3}
                value={content.seoDescription}
                onChange={(e) => setContent({ seoDescription: e.target.value })}
                className="input"
              />
            </F>
          </Card>

          <Card title="Invoice">
            <F label="Invoice prefix">
              <input
                value={inv.prefix}
                onChange={(e) => setInv({ prefix: e.target.value })}
                className="input"
              />
            </F>
            <F label="Company name">
              <input
                value={inv.companyName}
                onChange={(e) => setInv({ companyName: e.target.value })}
                className="input"
              />
            </F>
            <F label="Tagline">
              <input
                value={inv.tagline}
                onChange={(e) => setInv({ tagline: e.target.value })}
                className="input"
              />
            </F>
            <F label="Payment info">
              <textarea
                rows={2}
                value={inv.paymentInfo}
                onChange={(e) => setInv({ paymentInfo: e.target.value })}
                className="input"
              />
            </F>
            <F label="Terms & conditions">
              <textarea
                rows={3}
                value={inv.terms}
                onChange={(e) => setInv({ terms: e.target.value })}
                className="input"
              />
            </F>
            <F label="Footer note">
              <input
                value={inv.footerNote}
                onChange={(e) => setInv({ footerNote: e.target.value })}
                className="input"
              />
            </F>
            <F label="Signature label">
              <input
                value={inv.signatureName}
                onChange={(e) => setInv({ signatureName: e.target.value })}
                className="input"
              />
            </F>
            <F label="Accent color">
              <input
                type="color"
                value={inv.accentColor}
                onChange={(e) => setInv({ accentColor: e.target.value })}
                className="h-10 w-20 rounded-md border"
              />
            </F>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inv.showLogo}
                onChange={(e) => setInv({ showLogo: e.target.checked })}
              />
              ইনভয়েসে লোগো দেখান
            </label>
            <F label="Logo URL (ফাঁকা = ডিফল্ট লোগো)">
              <input
                value={s.logo ?? ""}
                onChange={(e) => setForm({ ...s, logo: e.target.value })}
                className="input"
              />
            </F>
          </Card>

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          <button
            disabled={saving}
            className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "সেভ হচ্ছে…" : "Save"}
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Live invoice preview</p>
          <div className="overflow-auto rounded-lg border bg-[#f2f2f2] p-3">
            <div className="origin-top scale-[0.85]">
              <InvoiceDocument order={SAMPLE} settings={s} />
            </div>
          </div>
        </div>
      </div>
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
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
