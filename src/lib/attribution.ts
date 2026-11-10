/**
 * ভিজিটর কোথা থেকে এসেছে সেটা browser-এ ধরে রাখা।
 *
 * কেন দরকার: TikTok/Facebook বিজ্ঞাপনে ক্লিক করলে লিংকে ttclid / fbclid / utm_*
 * থাকে, কিন্তু কাস্টমার ২–৩টা পেজ ঘুরে চেকআউটে যায় — ততক্ষণে URL থেকে সেগুলো
 * হারিয়ে যায়। আগে কোথাও সেভ করা হতো না, তাই অর্ডারে "কোথা থেকে এসেছে" জানার
 * কোনো উপায় ছিল না (TikTok-এ ৫০ অর্ডার দেখালেও ওয়েবসাইটে চেনা যেত না)।
 *
 * এখন: প্রথম পেজ লোডেই URL + referrer পড়ে localStorage-এ রাখা হয় (৩০ দিন)।
 * অর্ডার দেওয়ার সময় সেটা + pixel cookie (_fbp, _fbc, _ttp, _ga) server-এ যায়।
 * Server আবার নিজে User-Agent দেখে in-app browser চিনে নেয় — তাই localStorage
 * বন্ধ থাকলেও TikTok/Facebook অ্যাপ থেকে আসা অর্ডার চেনা যায়।
 */
import { type AttributionTouch, touchHasSignal } from "./order-source";

const STORE_KEY = "af_attr_v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ttclid",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

type Stored = { first?: AttributionTouch; last?: AttributionTouch };

/** Server-এ পাঠানো payload — placeOrder-এর zod schema এর সাথে মিল রেখে। */
export type AttributionPayload = AttributionTouch & {
  first_source_touch?: AttributionTouch;
  fbp?: string;
  fbc?: string;
  ttp?: string;
  ga_client_id?: string;
  page_url?: string;
};

const clip = (v: string | null | undefined, max = 300) => (v ? v.slice(0, max) : undefined);

function readStore(): Stored {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Stored;
    const fresh = (t?: AttributionTouch) =>
      t?.ts && Date.now() - new Date(t.ts).getTime() < MAX_AGE_MS ? t : undefined;
    return { first: fresh(parsed.first), last: fresh(parsed.last) };
  } catch {
    return {};
  }
}

function writeStore(s: Stored) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode — server UA detection still works */
  }
}

function externalReferrer(): string | undefined {
  try {
    const ref = document.referrer;
    if (!ref) return undefined;
    const host = new URL(ref).hostname;
    if (host === window.location.hostname) return undefined;
    return clip(ref);
  } catch {
    return undefined;
  }
}

let captured = false;

/**
 * প্রতিটি full page load-এ একবার (root থেকে) চলে।
 * নতুন signal থাকলে "last" আপডেট হয়; signal ছাড়া (direct/internal) ঢুকলে আগের
 * বিজ্ঞাপনের touch-টাই থেকে যায় — কারণ কাস্টমার পরে নিজে টাইপ করে ঢুকলেও
 * অর্ডারটা আসলে ওই বিজ্ঞাপনেরই।
 */
export function captureAttribution(): void {
  if (typeof window === "undefined" || captured) return;
  captured = true;
  try {
    const url = new URL(window.location.href);
    const touch: AttributionTouch = { ts: new Date().toISOString() };
    for (const p of PARAMS) {
      const v = url.searchParams.get(p);
      if (v) touch[p] = clip(v, 200);
    }
    const ref = externalReferrer();
    if (ref) touch.referrer = ref;
    touch.landing_page = clip(url.pathname + url.search, 500);

    if (!touchHasSignal(touch)) return;

    const store = readStore();
    writeStore({ first: store.first ?? touch, last: touch });

    // Facebook-এর _fbc cookie না থাকলে fbclid থেকে বানিয়ে রাখি (Meta-র নিয়ম মেনে)
    if (touch.fbclid && !readCookie("_fbc")) {
      setCookie("_fbc", `fb.1.${Date.now()}.${touch.fbclid}`, 90);
    }
    // TikTok click id আলাদা cookie-তে — Events API-তে লাগে
    if (touch.ttclid) setCookie("af_ttclid", touch.ttclid, 30);
  } catch {
    /* tracking must never break the shop */
  }
}

function readCookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"),
    );
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

function setCookie(name: string, value: string, days: number) {
  try {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** GA4 client id: _ga cookie "GA1.1.123.456" → "123.456" */
function gaClientId(): string | undefined {
  const ga = readCookie("_ga");
  if (!ga) return undefined;
  const parts = ga.split(".");
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : undefined;
}

/** চেকআউটে অর্ডারের সাথে যা যায়। */
export function getAttributionPayload(): AttributionPayload {
  if (typeof window === "undefined") return {};
  captureAttribution();
  const { first, last } = readStore();
  const touch: AttributionTouch = last ?? {};
  const payload: AttributionPayload = {
    ...touch,
    ttclid: touch.ttclid ?? readCookie("af_ttclid"),
    first_source_touch: first && first.ts !== last?.ts ? first : undefined,
    fbp: clip(readCookie("_fbp"), 200),
    fbc: clip(readCookie("_fbc"), 300),
    ttp: clip(readCookie("_ttp"), 200),
    ga_client_id: clip(gaClientId(), 100),
    page_url: clip(window.location.href, 500),
  };
  // undefined মানগুলো বাদ — payload ছোট থাকে
  return JSON.parse(JSON.stringify(payload)) as AttributionPayload;
}
