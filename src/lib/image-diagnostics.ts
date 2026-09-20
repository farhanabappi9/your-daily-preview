/**
 * Diagnostics for the image pipeline, served by src/server.ts at:
 *
 *     GET /api/img-status
 *
 * Optionally probe one specific image:
 *     /api/img-status?path=/api/public/img/1787076447584-dxheg0.png
 *     /api/img-status?path=/__l5e/assets-v1/xxxx/af-logo.jpeg
 *
 * This deliberately lives in a plain module rather than a TanStack file route.
 * A file route would have to be registered in the generated `routeTree.gen.ts`
 * before it type-checks, and it would not be reachable at all in any runtime
 * where the router is bypassed. src/server.ts sees every request first, so
 * handling it there means the diagnostics work even when the rest of the app
 * is broken — which is exactly when you need them.
 *
 * Nothing secret is ever printed: only booleans, hostnames and HTTP statuses.
 *
 * Reading the output — the three failures that look identical in a browser:
 *   r2.bound === false        the R2 binding is not reachable at all
 *   r2.objectCount === 0      R2 is reachable but empty
 *   probe 404s everywhere     the file is simply gone from every origin
 */

import {
  BUCKET,
  currentSupabaseUrl,
  legacyOrigins,
  lovableOrigin,
  objectKeyFromPath,
  serviceRoleKey,
} from "./image-serving";
import { getProductImagesBucket, getWorkerEnv } from "./worker-runtime";

export async function imageStatusResponse(
  request: Request,
  explicitEnv?: unknown,
): Promise<Response> {
  const url = new URL(request.url);
  const env = getWorkerEnv(explicitEnv, request);
  const bucket = getProductImagesBucket(explicitEnv, request);
  const supabase = currentSupabaseUrl(env);
  const legacy = legacyOrigins(env);
  const lovable = lovableOrigin(env);

  const r2: Record<string, unknown> = {
    binding: "PRODUCT_IMAGES",
    bucketName: BUCKET,
    bound: Boolean(bucket),
    objectCount: null,
    sampleKeys: [] as string[],
    error: null,
  };

  const supabaseReport: Record<string, unknown> = {
    configured: Boolean(supabase),
    host: supabase ? safeHost(supabase) : null,
    hasServiceRoleKey: Boolean(serviceRoleKey(env)),
    bucketReachable: null,
  };

  const report: Record<string, unknown> = {
    checkedAt: new Date().toISOString(),
    runtime: {
      // If this is false in production, Nitro's cloudflare preset did not run —
      // which would mean the bindings are genuinely unavailable.
      hasGlobalEnv: Boolean((globalThis as { __env__?: unknown }).__env__),
      hasEdgeCache: Boolean(
        (globalThis as unknown as { caches?: { default?: unknown } }).caches?.default,
      ),
    },
    r2,
    supabase: supabaseReport,
    legacyOrigins: legacy.map(safeHost),
    lovableOrigin: lovable ? safeHost(lovable) : null,
  };

  /* --- R2 --------------------------------------------------------- */
  if (bucket) {
    try {
      const listed = await bucket.list({ limit: 10 });
      r2.objectCount = listed.truncated ? `${listed.objects.length}+` : listed.objects.length;
      r2.sampleKeys = listed.objects.map((o) => o.key);
    } catch (error) {
      r2.error = String(error);
    }
  }

  /* --- Is the current Supabase project even alive? ----------------- */
  if (supabase) {
    try {
      const res = await fetch(`${supabase}/storage/v1/object/public/${BUCKET}/__probe__`);
      // 400/404 means the endpoint answered — the project is alive, the file
      // just is not there. 5xx or a thrown error means the project is not.
      supabaseReport.bucketReachable = res.status < 500;
      supabaseReport.probeStatus = res.status;
    } catch (error) {
      supabaseReport.bucketReachable = false;
      supabaseReport.probeError = String(error);
    }
  }

  /* --- Probe one real image --------------------------------------- */
  const testPath = url.searchParams.get("path");
  if (testPath) {
    const key = objectKeyFromPath(testPath);
    const results: Array<Record<string, unknown>> = [];

    if (key) {
      if (bucket) {
        try {
          const object = await bucket.get(key);
          results.push({ origin: "r2", found: Boolean(object), size: object?.size ?? null });
        } catch (error) {
          results.push({ origin: "r2", found: false, error: String(error) });
        }
      }

      const encoded = key.split("/").map(encodeURIComponent).join("/");
      for (const origin of [supabase, ...legacy].filter(Boolean) as string[]) {
        try {
          const res = await fetch(`${origin}/storage/v1/object/public/${BUCKET}/${encoded}`, {
            method: "HEAD",
          });
          results.push({ origin: safeHost(origin), found: res.ok, status: res.status });
        } catch (error) {
          results.push({ origin: safeHost(origin), found: false, error: String(error) });
        }
      }

      if (lovable && testPath.startsWith("/__l5e/")) {
        try {
          const res = await fetch(`${lovable}${testPath}`, { method: "HEAD" });
          results.push({ origin: "lovable", found: res.ok, status: res.status });
        } catch (error) {
          results.push({ origin: "lovable", found: false, error: String(error) });
        }
      }
    }

    report.probe = { path: testPath, key, results };
  }

  report.verdict = verdict(r2, supabaseReport);

  return new Response(JSON.stringify(report, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function safeHost(origin: string) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "invalid-url";
  }
}

function verdict(r2: Record<string, unknown>, supabase: Record<string, unknown>): string {
  if (!r2.bound) {
    return "R2 binding PRODUCT_IMAGES is NOT reachable. Run `npx wrangler r2 bucket create product-images`, keep the [[r2_buckets]] block in wrangler.toml, and redeploy.";
  }
  if (r2.objectCount === 0) {
    if (!supabase.configured) {
      return "R2 is empty and no Supabase origin is configured — nothing can be restored automatically. Upload the files with scripts/upload-to-r2.mjs.";
    }
    if (supabase.bucketReachable === false) {
      return "R2 is empty and Supabase Storage is unreachable. Recover the files from a backup or an older Supabase project (set LEGACY_IMAGE_ORIGINS), then run scripts/upload-to-r2.mjs.";
    }
    return "R2 is empty. Images will be pulled from Supabase on first request and backfilled automatically — unless the current Supabase project no longer holds them, in which case set LEGACY_IMAGE_ORIGINS to the old project URL and run the recovery scripts.";
  }
  return "R2 has objects and is bound. Images should be serving from R2.";
}
