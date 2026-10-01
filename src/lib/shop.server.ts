import { createClient } from "@supabase/supabase-js";

/**
 * Supabase credentials for server-side (SSR / Cloudflare Worker) code.
 *
 * Resolution order matters:
 *  1. `import.meta.env.VITE_*` — Vite replaces these with string literals at
 *     BUILD time, so they work on any host (Cloudflare Workers, Vercel,
 *     Netlify, Lovable) even when no runtime secret has been configured.
 *  2. `process.env.*` — runtime secrets (`wrangler secret put ...` or the
 *     hosting dashboard's environment variables).
 *
 * The previous version read `process.env` only. On a self-hosted Worker where
 * only the VITE_* build variables were set, `createClient(undefined, undefined)`
 * threw, every storefront query failed, and the site rendered with zero
 * products — which is exactly the "no products, no images" symptom.
 */
function resolveCredentials(): { url: string; key: string } {
  let buildUrl: string | undefined;
  let buildKey: string | undefined;
  try {
    buildUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    buildKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  } catch {
    /* import.meta.env is unavailable in some runtimes — fall through */
  }

  const url = buildUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    buildKey ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const missing = [...(!url ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : [])];
    throw new Error(
      `[storefront] Missing Supabase config: ${missing.join(", ")}. ` +
        `Set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY in the build environment, ` +
        `or SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY as runtime secrets.`,
    );
  }
  return { url, key };
}

/** True when the storefront can reach Supabase at all. Used by /api/health. */
export function hasStorefrontCredentials(): boolean {
  try {
    resolveCredentials();
    return true;
  } catch {
    return false;
  }
}

/** Non-secret snapshot of which config source won — safe to expose. */
export function credentialsDiagnostics() {
  let buildUrl: string | undefined;
  let buildKey: string | undefined;
  try {
    buildUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    buildKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  } catch {
    /* ignore */
  }
  const url = buildUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  return {
    viteUrlBakedIn: Boolean(buildUrl),
    viteKeyBakedIn: Boolean(buildKey),
    runtimeUrlPresent: Boolean(process.env.SUPABASE_URL),
    runtimeKeyPresent: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
    serviceRoleKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    // project ref only — never the key itself
    projectRef: url.replace(/^https?:\/\//, "").split(".")[0] || null,
  };
}

export function publicClient() {
  const { url, key } = resolveCredentials();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        // New-style Supabase keys (sb_publishable_...) are opaque, not JWTs.
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Detects the classic misconfiguration where SUPABASE_SERVICE_ROLE_KEY actually
 * holds the *anon / publishable* key.
 *
 * Symptom: product lookups (public read) work, but every write that needs the
 * service role (inserting into `orders`) fails with "permission denied" /
 * RLS violation, because `orders` has INSERT revoked from `anon`.
 *
 * Returns a human-readable problem string, or null when the key looks fine.
 * Never returns or logs the key itself.
 */
export function serviceKeyProblem(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY সেট করা নেই";

  if (key.startsWith("sb_publishable_")) {
    return "SUPABASE_SERVICE_ROLE_KEY-তে publishable key বসানো আছে (sb_secret_... বা service_role key দরকার)";
  }
  if (key.startsWith("sb_secret_")) return null;

  // Legacy JWT keys: check the `role` claim.
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
      if (payload?.role !== "service_role") {
        return `SUPABASE_SERVICE_ROLE_KEY-এর role = "${payload?.role}" — এটা service_role key নয়`;
      }
      return null;
    } catch {
      return "SUPABASE_SERVICE_ROLE_KEY পড়া যায়নি (ভুল ফরম্যাট)";
    }
  }
  return null;
}
