import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { saveSettings } from "@/lib/admin.functions";
import { getStorefront } from "@/lib/shop.functions";
import { DEFAULT_SETTINGS, type ShopSettings } from "@/lib/shop-types";
import { isValidTikTokPixelId } from "@/lib/tiktok-pixel";

export const Route = createFileRoute("/admin/tiktok-pixel")({
  head: () => ({
    meta: [
      { title: "TikTok Pixel — Admin" },
      { name: "description", content: "TikTok Pixel ID ও event সেটিংস।" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TikTokPixelPage,
});

const EVENTS: { name: string; when: string }[] = [
  { name: "PageView", when: "প্রতিটি পেজ ও SPA navigation-এ" },
  { name: "ViewContent", when: "প্রোডাক্ট ডিটেইল পেজ খুললে" },
  { name: "AddToCart", when: "কার্টে যোগ করলে (সব বাটন থেকেই)" },
  { name: "InitiateCheckout", when: "চেকআউট পেজ খুললে" },
  { name: "CompletePayment", when: "অর্ডার সফল হলে (thank-you পেজে)" },
];

function TikTokPixelPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["storefront"],
    queryFn: () => getStorefront(),
  });

  const saved = { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) } as ShopSettings;

  const [pixelId, setPixelId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // form state null থাকলে DB-র মান দেখাই — তাই save-এর পরে UI নিজে থেকেই sync থাকে
  const id = pixelId ?? saved.tiktokPixelId ?? "";
  const on = enabled ?? saved.tiktokPixelEnabled ?? true;
  const trimmed = id.trim();
  const valid = trimmed === "" || isValidTikTokPixelId(trimmed);
  const active = trimmed !== "" && on;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!valid) {
      setErr("Pixel ID সঠিক মনে হচ্ছে না — শুধু ইংরেজি অক্ষর ও সংখ্যা, ৮–৪০ ক্যারেক্টার।");
      return;
    }
    setSaving(true);
    try {
      // পুরো settings blob আবার পাঠানো হয় (এটাই এই প্রজেক্টের save pattern),
      // তাই অন্য কোনো সেটিং মুছে যাবে না।
      await saveSettings({
        data: {
          value: {
            ...saved,
            tiktokPixelId: trimmed,
            tiktokPixelEnabled: on,
          },
        },
      });
      await qc.invalidateQueries({ queryKey: ["storefront"] });
      setPixelId(null);
      setEnabled(null);
      setMsg("সেভ হয়েছে ✅ — সাইট একবার রিফ্রেশ করলেই পিক্সেল চালু হবে।");
    } catch (e2: unknown) {
      setErr((e2 as { message?: string })?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">TikTok Pixel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          শুধু TikTok Pixel ID বসিয়ে সেভ করুন — নিচের সব event স্বয়ংক্রিয়ভাবে fire হবে।
          Facebook Pixel আলাদাভাবে আগের মতোই চলবে।
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card title="Pixel সেটআপ">
          <F label="TikTok Pixel ID">
            <input
              value={id}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder={isLoading ? "লোড হচ্ছে…" : "যেমন: CQ1A2B3C4D5E6F7G8H9I"}
              className="input font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              TikTok Ads Manager → Tools/Assets → Events → Web Events → আপনার পিক্সেল →
              Pixel ID কপি করে এখানে বসান। খালি রাখলে TikTok-এর কোনো script লোডই হবে না।
            </span>
          </F>

          <label className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">Pixel চালু রাখুন (বন্ধ করলে ট্র্যাকিং হবে না)</span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="text-sm">
              Status:{" "}
              {active ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  Off
                </span>
              )}
            </span>
            {trimmed && (
              <a
                href={`https://ads.tiktok.com/i18n/events_manager/`}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline text-muted-foreground"
              >
                TikTok Events Manager খুলুন
              </a>
            )}
          </div>
        </Card>

        <Card title="যে event গুলো fire হবে">
          <ul className="space-y-2 text-sm">
            {EVENTS.map((e) => (
              <li key={e.name} className="flex flex-wrap items-baseline gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                  {e.name}
                </code>
                <span className="text-muted-foreground">{e.when}</span>
              </li>
            ))}
          </ul>
          <p className="pt-1 text-xs text-muted-foreground">
            সব event-এ value ও currency (BDT) পাঠানো হয়। CompletePayment-এ order number
            event_id হিসেবে যায়, তাই পেজ রিফ্রেশ করলেও ডাবল sale count হয় না।
          </p>
        </Card>

        {err && <p className="text-sm font-medium text-destructive">{err}</p>}
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

        <button
          disabled={saving}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "সেভ হচ্ছে…" : "Save TikTok Pixel"}
        </button>
      </form>

      <Card title="কিভাবে টেস্ট করবেন">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Chrome-এ “TikTok Pixel Helper” extension ইনস্টল করুন।</li>
          <li>ID সেভ করে সাইটের হোমপেজ খুলুন → PageView দেখা যাবে।</li>
          <li>একটি প্রোডাক্টে ঢুকুন → ViewContent, কার্টে দিন → AddToCart।</li>
          <li>চেকআউট পেজে যান → InitiateCheckout, অর্ডার দিন → CompletePayment।</li>
          <li>
            TikTok Events Manager-এ event গুলো ১৫–৩০ মিনিটের মধ্যে রিপোর্টে দেখা যাবে।
          </li>
        </ol>
      </Card>
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
