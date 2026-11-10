import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side tracking-এর গোপন key (Facebook CAPI token, TikTok Events API token,
 * GA4 API secret) — `private_settings` টেবিলে থাকে, যেটা শুধু admin পড়তে/লিখতে
 * পারে (RLS)। Browser-এ কখনো পুরো key ফেরত আসে না — শুধু "সেট আছে কি না" আর শেষ
 * ৪টা অক্ষর।
 */

const SECRET_KEYS = [
  "metaCapiToken",
  "metaTestEventCode",
  "tiktokAccessToken",
  "tiktokTestEventCode",
  "ga4ApiSecret",
] as const;

type SecretKey = (typeof SECRET_KEYS)[number];

export type SecretStatus = Record<SecretKey, { set: boolean; hint: string }>;

const ROW_KEY = "tracking";

function mask(v?: string): { set: boolean; hint: string } {
  const s = (v ?? "").trim();
  if (!s) return { set: false, hint: "" };
  return { set: true, hint: s.length > 8 ? `••••${s.slice(-4)}` : "••••" };
}

export const getTrackingSecretStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SecretStatus> => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("private_settings")
      .select("value")
      .eq("key", ROW_KEY)
      .maybeSingle();
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        throw new Error(
          "private_settings টেবিল নেই — supabase/migrations/20261110120000_order_source_tracking.sql ফাইলটা Supabase SQL Editor-এ Run করুন।",
        );
      }
      throw new Error(error.message);
    }
    const v = (data?.value ?? {}) as Partial<Record<SecretKey, string>>;
    return Object.fromEntries(SECRET_KEYS.map((k) => [k, mask(v[k])])) as SecretStatus;
  });

/**
 * শুধু যে key পাঠানো হয়েছে সেটাই বদলায়। খালি string ("") পাঠালে মুছে যায়,
 * undefined হলে আগেরটা থাকে।
 */
export const saveTrackingSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<Record<SecretKey, string>>) =>
    z
      .object({
        metaCapiToken: z.string().trim().max(600).optional(),
        metaTestEventCode: z.string().trim().max(60).optional(),
        tiktokAccessToken: z.string().trim().max(600).optional(),
        tiktokTestEventCode: z.string().trim().max(60).optional(),
        ga4ApiSecret: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: row, error: readError } = await db
      .from("private_settings")
      .select("value")
      .eq("key", ROW_KEY)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const next: Record<string, string> = { ...((row?.value ?? {}) as Record<string, string>) };
    for (const k of SECRET_KEYS) {
      const v = data[k];
      if (v === undefined) continue;
      if (v === "") delete next[k];
      else next[k] = v;
    }

    const { error } = await db
      .from("private_settings")
      .upsert({ key: ROW_KEY, value: next }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
