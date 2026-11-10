import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { saveSettings } from "@/lib/admin.functions";
import { saveTrackingSecrets } from "@/lib/tracking.functions";
import { isValidMetaPixelId, LEGACY_META_PIXEL_ID } from "@/lib/pixel";
import {
  Card,
  F,
  SecretField,
  StatusPill,
  useTrackingAdmin,
} from "@/components/admin/TrackingParts";

export const Route = createFileRoute("/admin/facebook-pixel")({
  head: () => ({
    meta: [
      { title: "Facebook Pixel — Admin" },
      { name: "description", content: "Facebook (Meta) Pixel ও Conversions API সেটিংস।" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FacebookPixelPage,
});

const EVENTS: { name: string; when: string }[] = [
  { name: "PageView", when: "প্রতিটি পেজ ও SPA navigation-এ" },
  { name: "ViewContent", when: "প্রোডাক্ট ডিটেইল পেজ খুললে" },
  { name: "AddToCart", when: "কার্টে যোগ করলে (সব বাটন থেকেই)" },
  { name: "InitiateCheckout", when: "চেকআউট পেজ খুললে" },
  { name: "Purchase", when: "অর্ডার সফল হলে — browser + server (Conversions API) দুই দিক থেকে" },
];

function FacebookPixelPage() {
  const qc = useQueryClient();
  const { saved, rawSettings, loading, secretStatus, secretError } = useTrackingAdmin();

  // কখনো সেভ না হয়ে থাকলে আগের hardcoded ID-টাই চলছে — সেটাই ফর্মে দেখাই
  const savedId =
    rawSettings.metaPixelId === undefined ? LEGACY_META_PIXEL_ID : (saved.metaPixelId ?? "");

  const [pixelId, setPixelId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [testCode, setTestCode] = useState<string | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const id = pixelId ?? savedId;
  const on = enabled ?? saved.metaPixelEnabled ?? true;
  const trimmed = id.trim();
  const valid = trimmed === "" || isValidMetaPixelId(trimmed);
  const active = trimmed !== "" && on;
  const capiOn =
    active && (token ? true : token === "" ? false : !!secretStatus?.metaCapiToken.set);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!valid) {
      setErr("Pixel ID সঠিক নয় — শুধু সংখ্যা, ১০–২০ ডিজিট (যেমন 1333331668960638)।");
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        data: { scope: "tracking", value: { metaPixelId: trimmed, metaPixelEnabled: on } },
      });
      if (token !== undefined || testCode !== undefined) {
        await saveTrackingSecrets({
          data: { metaCapiToken: token, metaTestEventCode: testCode },
        });
      }
      await qc.invalidateQueries({ queryKey: ["storefront"] });
      await qc.invalidateQueries({ queryKey: ["tracking-secrets"] });
      setPixelId(null);
      setEnabled(null);
      setToken(undefined);
      setTestCode(undefined);
      setMsg("সেভ হয়েছে ✅ — সাইট একবার রিফ্রেশ করলেই নতুন পিক্সেল চালু হবে।");
    } catch (e2: unknown) {
      setErr((e2 as { message?: string })?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Facebook Pixel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pixel ID বসিয়ে সেভ করুন — নিচের সব event স্বয়ংক্রিয়ভাবে fire হবে। Conversions API token
          দিলে অর্ডারের Purchase event server থেকেও যাবে (ad blocker / iPhone-এও গোনা হবে)।
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card title="Pixel সেটআপ">
          <F label="Facebook Pixel ID (Dataset ID)">
            <input
              value={id}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder={loading ? "লোড হচ্ছে…" : "যেমন: 1333331668960638"}
              className="input font-mono"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Meta Events Manager → Data sources → আপনার Pixel → Settings → Pixel ID (শুধু সংখ্যা)।
              খালি রাখলে Facebook-এর কোনো script লোডই হবে না।
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
              Conversions API: <StatusPill on={capiOn} />
            </span>
          </div>
        </Card>

        <Card title="Server-side — Conversions API (ঐচ্ছিক, কিন্তু খুবই দরকারি)">
          {secretError && <p className="text-xs text-destructive">{secretError}</p>}
          <SecretField
            label="Conversions API Access Token"
            status={secretStatus?.metaCapiToken}
            value={token}
            onChange={setToken}
            placeholder="EAAG..."
            help={
              <>
                Events Manager → আপনার Pixel → Settings → “Conversions API” → “Generate access
                token”। Token কখনো ওয়েবসাইটে দেখা যায় না — শুধু server ব্যবহার করে।
              </>
            }
          />
          <SecretField
            label="Test Event Code (শুধু টেস্টের সময়)"
            status={secretStatus?.metaTestEventCode}
            value={testCode}
            onChange={setTestCode}
            placeholder="TEST12345"
            help="Events Manager → Test events থেকে কোড বসালে server event সেখানে লাইভ দেখা যাবে। টেস্ট শেষে অবশ্যই মুছে দিন।"
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
            সব event-এ value ও currency (BDT) যায়। Purchase-এ browser ও server দুই জায়গাতেই একই
            event ID (purchase-অর্ডার নম্বর) যায়, তাই Facebook একটা অর্ডার কখনো দুইবার গোনে না।
          </p>
        </Card>

        {err && <p className="text-sm font-medium text-destructive">{err}</p>}
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

        <button
          disabled={saving}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "সেভ হচ্ছে…" : "Save Facebook Pixel"}
        </button>
      </form>

      <Card title="কিভাবে টেস্ট করবেন">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Chrome-এ “Meta Pixel Helper” extension ইনস্টল করুন।</li>
          <li>ID সেভ করে সাইটের হোমপেজ খুলুন → PageView দেখা যাবে।</li>
          <li>একটি প্রোডাক্টে ঢুকুন → ViewContent, কার্টে দিন → AddToCart।</li>
          <li>চেকআউটে যান → InitiateCheckout, অর্ডার দিন → Purchase।</li>
          <li>
            Test Event Code বসিয়ে অর্ডার দিলে Events Manager → Test events-এ “Server” লেখা Purchase
            দেখা যাবে — মানে Conversions API কাজ করছে।
          </li>
        </ol>
      </Card>
    </div>
  );
}
