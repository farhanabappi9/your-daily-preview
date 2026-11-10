
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { saveSettings } from "@/lib/admin.functions";
import { saveTrackingSecrets } from "@/lib/tracking.functions";
import { isValidTikTokPixelId } from "@/lib/tiktok-pixel";
import {
  Card,
  F,
  SecretField,
  StatusPill,
  useTrackingAdmin,
} from "@/components/admin/TrackingParts";

export const Route = createFileRoute("/admin/tiktok-pixel")({
  head: () => ({
    meta: [
      { title: "TikTok Pixel — Admin" },
      { name: "description", content: "TikTok Pixel ID, Events API ও event সেটিংস।" },
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
  {
    name: "CompletePayment",
    when: "অর্ডার সফল হলে — browser + server (Events API) দুই দিক থেকে",
  },
];

function TikTokPixelPage() {
  const qc = useQueryClient();
  const { saved, loading, secretStatus, secretError } = useTrackingAdmin();

  const [pixelId, setPixelId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [testCode, setTestCode] = useState<string | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // form state null থাকলে DB-র মান দেখাই — তাই save-এর পরে UI নিজে থেকেই sync থাকে
  const id = pixelId ?? saved.tiktokPixelId ?? "";
  const on = enabled ?? saved.tiktokPixelEnabled ?? true;
  const trimmed = id.trim();
  const valid = trimmed === "" || isValidTikTokPixelId(trimmed);
  const active = trimmed !== "" && on;
  const apiOn =
    active && (token ? true : token === "" ? false : !!secretStatus?.tiktokAccessToken.set);

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
      // শুধু TikTok-এর ঘরগুলো যায় (scope: tracking) — অন্য কোনো সেটিং মুছে যাবে না
      await saveSettings({
        data: { scope: "tracking", value: { tiktokPixelId: trimmed, tiktokPixelEnabled: on } },
      });
      if (token !== undefined || testCode !== undefined) {
        await saveTrackingSecrets({
          data: { tiktokAccessToken: token, tiktokTestEventCode: testCode },
        });
      }
      await qc.invalidateQueries({ queryKey: ["storefront"] });
      await qc.invalidateQueries({ queryKey: ["tracking-secrets"] });
      setPixelId(null);
      setEnabled(null);
      setToken(undefined);
      setTestCode(undefined);
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
          শুধু TikTok Pixel ID বসিয়ে সেভ করুন — নিচের সব event স্বয়ংক্রিয়ভাবে fire হবে। Events
          API token দিলে অর্ডার server থেকেও TikTok-এ যাবে।
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card title="Pixel সেটআপ">
          <F label="TikTok Pixel ID">
            <input
              value={id}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder={loading ? "লোড হচ্ছে…" : "যেমন: CQ1A2B3C4D5E6F7G8H9I"}
              className="input font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              TikTok Ads Manager → Tools/Assets → Events → Web Events → আপনার পিক্সেল → Pixel ID কপি
              করে এখানে বসান। খালি রাখলে TikTok-এর কোনো script লোডই হবে না।
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

          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
            <span>
              Browser Pixel: <StatusPill on={active} />
            </span>
            <span>
              Events API: <StatusPill on={apiOn} />
            </span>
            {trimmed && (
              <a
                href="https://ads.tiktok.com/i18n/events_manager/"
                target="_blank"
                rel="noreferrer"
                className="text-xs underline text-muted-foreground"
              >
                TikTok Events Manager খুলুন
              </a>
            )}
          </div>
        </Card>

        <Card title="Server-side — TikTok Events API (ঐচ্ছিক, কিন্তু খুবই দরকারি)">
          {secretError && <p className="text-xs text-destructive">{secretError}</p>}
          <SecretField
            label="Events API Access Token"
            status={secretStatus?.tiktokAccessToken}
            value={token}
            onChange={setToken}
            help="Events Manager → আপনার পিক্সেল → Settings → “Generate Access Token”। Token কখনো ওয়েবসাইটে দেখা যায় না — শুধু server ব্যবহার করে।"
          />
          <SecretField
            label="Test Event Code (শুধু টেস্টের সময়)"
            status={secretStatus?.tiktokTestEventCode}
            value={testCode}
            onChange={setTestCode}
            placeholder="TEST12345"
            help="Events Manager → Test Events থেকে কোড বসালে server event সেখানে লাইভ দেখা যাবে। টেস্ট শেষে অবশ্যই মুছে দিন।"
          />
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
            সব event-এ value ও currency (BDT) পাঠানো হয়। CompletePayment-এ browser ও server দুই
            জায়গাতেই একই event_id (purchase-অর্ডার নম্বর) যায়, তাই TikTok ডাবল sale গোনে না।
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

      <Card title="TikTok-এর অর্ডার ওয়েবসাইটে চিনবেন কিভাবে">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Orders পেজে নতুন “Source” কলাম আছে — TikTok থেকে আসা প্রতিটি অর্ডারে কালো “TikTok” badge
            দেখাবে। উপরের “TikTok” বাটনে চাপলে শুধু TikTok-এর অর্ডার দেখাবে, CSV-ও নামানো যাবে।
          </li>
          <li>
            TikTok Ads Manager → Campaign → Destination URL-এর শেষে{" "}
            <code className="rounded bg-muted px-1">
              ?utm_source=tiktok&amp;utm_medium=paid&amp;utm_campaign=__CAMPAIGN_NAME__
            </code>{" "}
            যোগ করুন — তাহলে কোন ক্যাম্পেইন থেকে অর্ডার এসেছে সেটাও দেখা যাবে।
          </li>
          <li>
            TikTok নিজের হিসাবে “view-through” (বিজ্ঞাপন দেখে পরে নিজে এসে অর্ডার) ও অন্য ডিভাইসের
            অর্ডারও গোনে, তাই TikTok-এর সংখ্যা ওয়েবসাইটের চেয়ে কিছুটা বেশি দেখাতে পারে।
          </li>
        </ul>
      </Card>

      <Card title="কিভাবে টেস্ট করবেন">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Chrome-এ “TikTok Pixel Helper” extension ইনস্টল করুন।</li>
          <li>ID সেভ করে সাইটের হোমপেজ খুলুন → PageView দেখা যাবে।</li>
          <li>একটি প্রোডাক্টে ঢুকুন → ViewContent, কার্টে দিন → AddToCart।</li>
          <li>চেকআউট পেজে যান → InitiateCheckout, অর্ডার দিন → CompletePayment।</li>
          <li>TikTok Events Manager-এ event গুলো ১৫–৩০ মিনিটের মধ্যে রিপোর্টে দেখা যাবে।</li>
        </ol>
      </Card>
    </div>
  );
}
