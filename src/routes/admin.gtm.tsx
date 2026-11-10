import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { saveSettings } from "@/lib/admin.functions";
import { saveTrackingSecrets } from "@/lib/tracking.functions";
import { isValidGa4Id, isValidGtmId, isValidGtmServerUrl } from "@/lib/gtm";
import {
  Card,
  F,
  SecretField,
  StatusPill,
  useTrackingAdmin,
} from "@/components/admin/TrackingParts";

export const Route = createFileRoute("/admin/gtm")({
  head: () => ({
    meta: [
      { title: "Google Tag Manager — Admin" },
      {
        name: "description",
        content: "Google Tag Manager, server-side GTM ও GA4 server tracking সেটিংস।",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GtmPage,
});

const EVENTS: { name: string; when: string }[] = [
  { name: "page_view", when: "প্রতিটি SPA navigation-এ (প্রথমটা GTM নিজে ধরে)" },
  { name: "view_item", when: "প্রোডাক্ট পেজ খুললে" },
  { name: "add_to_cart", when: "কার্টে যোগ করলে" },
  { name: "begin_checkout", when: "চেকআউট পেজ খুললে" },
  { name: "purchase", when: "অর্ডার সফল হলে (transaction_id = অর্ডার নম্বর)" },
];

function GtmPage() {
  const qc = useQueryClient();
  const { saved, loading, secretStatus, secretError } = useTrackingAdmin();

  const [gtmId, setGtmId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [ga4Id, setGa4Id] = useState<string | null>(null);
  const [ga4Secret, setGa4Secret] = useState<string | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const id = (gtmId ?? saved.gtmId ?? "").trim().toUpperCase();
  const on = enabled ?? saved.gtmEnabled ?? true;
  const url = (serverUrl ?? saved.gtmServerUrl ?? "").trim();
  const ga4 = (ga4Id ?? saved.ga4MeasurementId ?? "").trim().toUpperCase();
  const active = id !== "" && on && isValidGtmId(id);
  const ga4ServerOn =
    ga4 !== "" && (ga4Secret ? true : ga4Secret === "" ? false : !!secretStatus?.ga4ApiSecret.set);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (id && !isValidGtmId(id)) {
      setErr("GTM ID সঠিক নয় — দেখতে এমন হবে: GTM-ABC1234");
      return;
    }
    if (!isValidGtmServerUrl(url)) {
      setErr(
        "Server container URL অবশ্যই https:// দিয়ে শুরু হবে, যেমন https://sgtm.yourdomain.com",
      );
      return;
    }
    if (!isValidGa4Id(ga4)) {
      setErr("GA4 Measurement ID সঠিক নয় — দেখতে এমন হবে: G-ABC123XYZ");
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        data: {
          scope: "tracking",
          value: {
            gtmId: id,
            gtmEnabled: on,
            gtmServerUrl: url.replace(/\/+$/, ""),
            ga4MeasurementId: ga4,
          },
        },
      });
      if (ga4Secret !== undefined) {
        await saveTrackingSecrets({ data: { ga4ApiSecret: ga4Secret } });
      }
      await qc.invalidateQueries({ queryKey: ["storefront"] });
      await qc.invalidateQueries({ queryKey: ["tracking-secrets"] });
      setGtmId(null);
      setEnabled(null);
      setServerUrl(null);
      setGa4Id(null);
      setGa4Secret(undefined);
      setMsg("সেভ হয়েছে ✅ — সাইট একবার রিফ্রেশ করলেই চালু হবে।");
    } catch (e2: unknown) {
      setErr((e2 as { message?: string })?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Google Tag Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          GTM ID বসালেই ওয়েবসাইটে GTM লোড হবে আর সব ecommerce event (view_item, add_to_cart,
          begin_checkout, purchase) dataLayer-এ চলে যাবে।
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card title="১. Google Tag Manager (সবচেয়ে জরুরি)">
          <F label="GTM Container ID">
            <input
              value={id}
              onChange={(e) => setGtmId(e.target.value)}
              placeholder={loading ? "লোড হচ্ছে…" : "যেমন: GTM-ABC1234"}
              className="input font-mono uppercase"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              tagmanager.google.com → আপনার Container → উপরে ডান দিকে “GTM-…” লেখা ID।
            </span>
          </F>
          <label className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">GTM চালু রাখুন</span>
          </label>
          <div className="text-sm">
            Status: <StatusPill on={active} />
          </div>
        </Card>

        <Card title="২. Server-side GTM (ঐচ্ছিক)">
          <F label="Server container URL">
            <input
              value={url}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="যেমন: https://sgtm.yourdomain.com"
              className="input font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </F>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              শুধু GTM ID দিয়ে “server-side” হয় না — Google-এর নিয়মে একটা আলাদা server container
              চালাতে হয়। সবচেয়ে সহজ উপায়:
            </p>
            <ol className="list-decimal space-y-0.5 pl-5">
              <li>GTM-এ “Server” টাইপের নতুন container বানান।</li>
              <li>
                stape.io-তে ফ্রি অ্যাকাউন্ট খুলে সেই container-এর config দিন — একটা URL পাবেন।
              </li>
              <li>
                নিজের ডোমেইনে sub-domain (যেমন sgtm.yourdomain.com) সেট করে সেই URL এখানে বসান।
              </li>
            </ol>
            <p>
              বসালে gtm.js আপনার নিজের ডোমেইন থেকে লোড হবে (ad blocker কম আটকায়)। খালি রাখলে সাধারণ
              Google GTM চলবে।
            </p>
          </div>
        </Card>

        <Card title="৩. GA4 — server থেকে Purchase (ঐচ্ছিক)">
          {secretError && <p className="text-xs text-destructive">{secretError}</p>}
          <F label="GA4 Measurement ID">
            <input
              value={ga4}
              onChange={(e) => setGa4Id(e.target.value)}
              placeholder="যেমন: G-ABC123XYZ"
              className="input font-mono uppercase"
              autoComplete="off"
              spellCheck={false}
            />
          </F>
          <SecretField
            label="Measurement Protocol API secret"
            status={secretStatus?.ga4ApiSecret}
            value={ga4Secret}
            onChange={setGa4Secret}
            help="GA4 → Admin → Data streams → আপনার web stream → Measurement Protocol API secrets → Create। এটা দিলে প্রতিটি অর্ডার সরাসরি server থেকে GA4-এ যাবে (ad blocker থাকলেও)।"
          />
          <div className="text-sm">
            GA4 server purchase: <StatusPill on={ga4ServerOn} />
          </div>
          <p className="text-xs text-muted-foreground">
            GA4 tag GTM-এর ভিতরেই বসান (Google tag → এই Measurement ID)। এখানে ID দিলে শুধু server
            থেকে purchase যায়; browser আর server দুইটাতেই একই transaction_id, তাই GA4 দুইবার গোনে
            না।
          </p>
        </Card>

        <Card title="dataLayer-এ যে event গুলো যাবে">
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
            সব event GA4-এর standard ecommerce ফরম্যাটে (currency BDT, items, value)। purchase-এ
            user_data.phone_number থাকে — Google Ads Enhanced Conversions-এ কাজে লাগে।
          </p>
        </Card>

        {err && <p className="text-sm font-medium text-destructive">{err}</p>}
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

        <button
          disabled={saving}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "সেভ হচ্ছে…" : "Save Google Tag Manager"}
        </button>
      </form>

      <Card title="সতর্কতা — ডাবল গোনা এড়াতে">
        <p className="text-sm text-muted-foreground">
          Facebook Pixel আর TikTok Pixel এই ওয়েবসাইট নিজেই চালায় (আলাদা পেজ থেকে)। তাই GTM-এর
          ভিতরে আবার Facebook / TikTok-এর base pixel tag বসাবেন না — বসালে প্রতিটি event দুইবার গোনা
          হবে। GTM ব্যবহার করুন GA4, Google Ads ও অন্যান্য tag-এর জন্য।
        </p>
      </Card>
    </div>
  );
}
