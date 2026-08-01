import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { saveSettings } from "@/lib/admin.functions";
import { getStorefront } from "@/lib/shop.functions";
import { DEFAULT_SETTINGS } from "@/lib/shop-types";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["storefront"], queryFn: () => getStorefront() });
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const s = form ?? { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) };
  const set = (patch: any) => setForm({ ...s, ...patch });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await saveSettings({
        data: {
          value: {
            ...s,
            shippingInside: Number(s.shippingInside),
            shippingOutside: Number(s.shippingOutside),
            freeShippingOver: Number(s.freeShippingOver),
          },
        },
      });
      await qc.invalidateQueries({ queryKey: ["storefront"] });
      setMsg("সেভ হয়েছে ✅");
    } catch (err: any) {
      setMsg(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold sm:text-2xl">Shop settings</h1>
      <form onSubmit={submit} className="space-y-4">
        <Card title="দোকানের তথ্য">
          <F label="Shop name">
            <input
              value={s.name ?? ""}
              onChange={(e) => set({ name: e.target.value })}
              className="input"
            />
          </F>
          <F label="Phone">
            <input
              value={s.phone ?? ""}
              onChange={(e) => set({ phone: e.target.value })}
              className="input"
            />
          </F>
          <F label="WhatsApp">
            <input
              value={s.whatsapp ?? ""}
              onChange={(e) => set({ whatsapp: e.target.value })}
              className="input"
            />
          </F>
          <F label="Email">
            <input
              value={s.email ?? ""}
              onChange={(e) => set({ email: e.target.value })}
              className="input"
            />
          </F>
          <F label="Address">
            <input
              value={s.address ?? ""}
              onChange={(e) => set({ address: e.target.value })}
              className="input"
            />
          </F>
          <F label="Facebook page">
            <input
              value={s.facebook ?? ""}
              onChange={(e) => set({ facebook: e.target.value })}
              className="input"
            />
          </F>
        </Card>

        <Card title="ডেলিভারি">
          <F label="ঢাকার ভিতরে (৳)">
            <input
              type="number"
              value={s.shippingInside}
              onChange={(e) => set({ shippingInside: e.target.value })}
              className="input"
            />
          </F>
          <F label="ঢাকার বাইরে (৳)">
            <input
              type="number"
              value={s.shippingOutside}
              onChange={(e) => set({ shippingOutside: e.target.value })}
              className="input"
            />
          </F>
          <F label="ফ্রি ডেলিভারি এর উপরে (৳, 0 = বন্ধ)">
            <input
              type="number"
              value={s.freeShippingOver}
              onChange={(e) => set({ freeShippingOver: e.target.value })}
              className="input"
            />
          </F>
        </Card>

        <Card title="সোশ্যাল">
          <F label="Instagram">
            <input
              value={s.instagram ?? ""}
              onChange={(e) => set({ instagram: e.target.value })}
              className="input"
            />
          </F>
        </Card>

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <button
          disabled={saving}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "সেভ হচ্ছে…" : "Save settings"}
        </button>
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
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
