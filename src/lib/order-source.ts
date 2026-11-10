/**
 * অর্ডার কোথা থেকে এসেছে (TikTok / Facebook / Instagram / Google / YouTube / Direct …)
 * সেটা বের করার pure লজিক।
 *
 * এই ফাইলে window / localStorage / process — কিছুই ব্যবহার করা হয়নি, তাই একই
 * ফাংশন browser (checkout), server (placeOrder) আর admin প্যানেল — তিন জায়গাতেই
 * নিরাপদে চলে।
 *
 * কোন signal কত শক্তিশালী (উপর থেকে নিচে):
 *   1. বিজ্ঞাপনের click id  — ttclid (TikTok), fbclid (Facebook), gclid/gbraid/wbraid (Google)
 *   2. utm_source            — বিজ্ঞাপনের লিংকে নিজে বসানো থাকলে
 *   3. referrer              — কোন সাইট থেকে ক্লিক করে এসেছে
 *   4. in-app browser        — TikTok / Facebook / Instagram অ্যাপের ভিতরের ব্রাউজার
 *   5. কিছুই না পেলে         — "direct"
 */

export const ORDER_SOURCES = [
  "tiktok",
  "facebook",
  "instagram",
  "google",
  "youtube",
  "other",
  "direct",
] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];

export type SourceMedium = "paid" | "organic" | "referral" | "direct";

export const SOURCE_LABEL: Record<OrderSource | "unknown", string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  youtube: "YouTube",
  other: "অন্যান্য",
  direct: "Direct",
  unknown: "অজানা (পুরনো)",
};

/** Admin প্যানেলে badge-এর রং (Tailwind class)। */
export const SOURCE_BADGE: Record<OrderSource | "unknown", string> = {
  tiktok: "bg-neutral-900 text-white",
  facebook: "bg-blue-600 text-white",
  instagram: "bg-pink-600 text-white",
  google: "bg-amber-500 text-white",
  youtube: "bg-red-600 text-white",
  other: "bg-slate-200 text-slate-800",
  direct: "bg-emerald-100 text-emerald-800",
  unknown: "bg-muted text-muted-foreground",
};

export type AttributionTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  ttclid?: string;
  fbclid?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  /** বাইরের যে সাইট থেকে এসেছে (নিজের ডোমেইন হলে খালি) */
  referrer?: string;
  /** প্রথম যে পেজে ঢুকেছিল */
  landing_page?: string;
  /** ISO সময় */
  ts?: string;
};

export type DetectInput = AttributionTouch & { user_agent?: string | null };

export type DetectResult = { source: OrderSource; medium: SourceMedium; reason: string };

const TIKTOK_UA = /musical_ly|bytedancewebview|bytelocale|tiktok|trill_|aweme/i;
const INSTAGRAM_UA = /instagram/i;
const FACEBOOK_UA = /fban|fbav|fb_iab|fbios|fb4a|messenger|fbsv/i;

const PAID_MEDIUM = /cpc|ppc|paid|ads?$|^ad|cpm|display|sponsored|boost/i;

function matchName(raw: string): OrderSource | null {
  const v = raw.toLowerCase().trim();
  if (!v) return null;
  if (/tiktok|^tt$|^tt_|bytedance|pangle/.test(v)) return "tiktok";
  if (/instagram|^ig$|^ig_/.test(v)) return "instagram";
  if (/facebook|^fb$|^fb_|meta|messenger/.test(v)) return "facebook";
  if (/youtube|^yt$/.test(v)) return "youtube";
  if (/google|adwords|gads|^gdn$|^pmax$/.test(v)) return "google";
  return null;
}

function hostOf(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function matchHost(host: string): OrderSource | null {
  if (!host) return null;
  if (/(^|\.)tiktok\.com$|(^|\.)tiktokv\.com$|(^|\.)tiktokcdn\.com$|bytedance/.test(host))
    return "tiktok";
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$|(^|\.)messenger\.com$/.test(host))
    return "facebook";
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return "youtube";
  if (/(^|\.)google\.[a-z.]+$|(^|\.)googleadservices\.com$|(^|\.)doubleclick\.net$/.test(host))
    return "google";
  return null;
}

/** In-app browser দেখে অ্যাপ চেনা — click id / utm না থাকলেও কাজ করে। */
export function sourceFromUserAgent(ua?: string | null): OrderSource | null {
  const v = ua ?? "";
  if (!v) return null;
  if (TIKTOK_UA.test(v)) return "tiktok";
  if (INSTAGRAM_UA.test(v)) return "instagram";
  if (FACEBOOK_UA.test(v)) return "facebook";
  return null;
}

export function detectOrderSource(input: DetectInput): DetectResult {
  const medium = (input.utm_medium ?? "").trim();

  // 1. click id — বিজ্ঞাপনে ক্লিক করলে প্ল্যাটফর্ম নিজে থেকেই লিংকে বসিয়ে দেয়
  if (input.ttclid) return { source: "tiktok", medium: "paid", reason: "ttclid" };
  if (input.gclid || input.gbraid || input.wbraid) {
    const byUtm = matchName(input.utm_source ?? "");
    return { source: byUtm === "youtube" ? "youtube" : "google", medium: "paid", reason: "gclid" };
  }
  if (input.fbclid) {
    // Instagram বিজ্ঞাপনেও fbclid আসে — utm/referrer/UA দেখে Instagram আলাদা করি
    const ig =
      matchName(input.utm_source ?? "") === "instagram" ||
      matchHost(hostOf(input.referrer)) === "instagram" ||
      sourceFromUserAgent(input.user_agent) === "instagram";
    const paid = PAID_MEDIUM.test(medium) || !!input.utm_campaign;
    return {
      source: ig ? "instagram" : "facebook",
      medium: paid ? "paid" : "referral",
      reason: "fbclid",
    };
  }

  // 2. utm_source
  const utmSource = (input.utm_source ?? "").trim();
  if (utmSource) {
    const s = matchName(utmSource) ?? "other";
    return {
      source: s,
      medium: PAID_MEDIUM.test(medium) ? "paid" : "referral",
      reason: "utm_source",
    };
  }

  // 3. referrer
  const refSource = matchHost(hostOf(input.referrer));
  if (refSource) {
    return {
      source: refSource,
      medium: refSource === "google" ? "organic" : "referral",
      reason: "referrer",
    };
  }

  // 4. in-app browser
  const uaSource = sourceFromUserAgent(input.user_agent);
  if (uaSource) return { source: uaSource, medium: "referral", reason: "in_app_browser" };

  // 5. অন্য কোনো সাইট থেকে এসেছে
  if (hostOf(input.referrer)) return { source: "other", medium: "referral", reason: "referrer" };

  return { source: "direct", medium: "direct", reason: "none" };
}

/** Touch-এ কোনো marketing signal আছে কি না (না থাকলে আগের touch রেখে দিই)। */
export function touchHasSignal(t: AttributionTouch): boolean {
  return Boolean(
    t.ttclid ||
    t.fbclid ||
    t.gclid ||
    t.gbraid ||
    t.wbraid ||
    t.utm_source ||
    t.utm_medium ||
    t.utm_campaign ||
    t.referrer,
  );
}

/** DB-র source মান থেকে admin label/badge key — পুরনো অর্ডারে null থাকে। */
export function sourceKey(raw?: string | null): OrderSource | "unknown" {
  return (ORDER_SOURCES as readonly string[]).includes(raw ?? "")
    ? (raw as OrderSource)
    : "unknown";
}

/**
 * বাংলাদেশি মোবাইল নম্বর একরকম করা: বাংলা সংখ্যা → ইংরেজি, +88/88 বাদ, স্পেস/ড্যাশ বাদ।
 * সঠিক হলে "01XXXXXXXXX" (১১ ডিজিট) ফেরত দেয়, না হলে null।
 * Steadfast শুধু ১১ ডিজিটের নম্বর নেয়, তাই অর্ডার নেওয়ার সময়েই ঠিক করে রাখা হয়।
 */
export function normalizeBdPhone(raw: string): string | null {
  const bn = "০১২৩৪৫৬৭৮৯";
  let digits = "";
  for (const ch of raw ?? "") {
    const i = bn.indexOf(ch);
    if (i >= 0) digits += String(i);
    else if (ch >= "0" && ch <= "9") digits += ch;
  }
  if (digits.startsWith("880")) digits = digits.slice(2);
  else if (digits.startsWith("88") && digits.length === 13) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}
