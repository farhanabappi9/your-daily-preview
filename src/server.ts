import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/* ------------------------------------------------------------------ *
 * Legacy asset compatibility
 *
 * Every image URL in this project — the rows in `products.images` and
 * `categories.image`, the bundled catalog in src/lib/products.ts, the
 * category tiles, and the hero cover — points at
 *   /__l5e/assets-v1/<asset-id>/<filename>
 *
 * That path is served by Lovable's own asset host. On a self-hosted
 * Cloudflare Worker nothing answers it, so every image 404s.
 *
 * Rather than rewriting ~120 database rows plus the bundled code, we make
 * the path work here: the asset id is ignored and the file is looked up by
 * filename in the public `product-images` bucket under `catalog/`.
 * Run scripts/migrate-assets-to-supabase.mjs once to populate that folder.
 * ------------------------------------------------------------------ */

const LEGACY_ASSET_PREFIX = "/__l5e/assets-v1/";
const ASSET_FOLDER = "catalog";
const BUCKET = "product-images";

function supabaseBaseUrl(): string | undefined {
  let baked: string | undefined;
  try {
    baked = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  } catch {
    /* import.meta.env unavailable in this runtime */
  }
  const url = baked || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : undefined;
}

/* ------------------------------------------------------------------ *
 * Product images: R2-first, Supabase-fallback (added 2026-09-03)
 *
 * Why this lives here and not in src/routes/api/public/img/$.ts:
 * the R2 binding only exists on the raw Cloudflare `env` object passed
 * into this file's top-level `fetch(request, env, ctx)`. TanStack's file
 * routes don't get that `env` threaded through, so any code that needs
 * the binding has to run at this level — same reason the legacy-asset
 * handler above lives here instead of in a route file.
 *
 * Behaviour:
 *   GET  /api/public/img/<path>   → R2 first; on miss, Supabase public
 *                                    URL as a fallback for images that
 *                                    haven't been migrated yet (and the
 *                                    fallback result is written into R2
 *                                    in the background, so it only ever
 *                                    has to come from Supabase once).
 *                                    Also cached at Cloudflare's edge.
 *   POST /api/public/img/upload   → admin-only, streams the upload
 *                                    straight into R2. Requires a
 *                                    Supabase Bearer token (checked the
 *                                    same way requireSupabaseAuth does).
 *
 * One-time setup (see the deploy notes) before this works:
 *   npx wrangler r2 bucket create product-images
 * and the [[r2_buckets]] binding in wrangler.toml.
 * ------------------------------------------------------------------ */

type R2Bucket = {
  get: (key: string) => Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  put: (
    key: string,
    value: ArrayBuffer | ReadableStream | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
};

type WorkerEnv = {
  PRODUCT_IMAGES?: R2Bucket;
};

type WorkerCtx = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

const IMG_PREFIX = "/api/public/img/";
const IMG_UPLOAD_PATH = "/api/public/img/upload";
const IMG_CACHE_HEADERS = {
  "cache-control": "public, max-age=31536000, immutable",
};

function getEdgeCache(): Cache | undefined {
  const c = (globalThis as unknown as { caches?: { default?: Cache } }).caches;
  return c?.default;
}

/** Same Bearer-token check as requireSupabaseAuth, without the TanStack middleware wrapper. */
async function requireAdminToken(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);
  if (!token || token.split(".").length !== 3) return false;

  const base = supabaseBaseUrl();
  let key: string | undefined;
  try {
    key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  } catch {
    /* import.meta.env unavailable in this runtime */
  }
  key = key || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return false;

  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function serveProductImage(pathname: string, env: WorkerEnv, ctx: WorkerCtx): Promise<Response> {
  const path = pathname.slice(IMG_PREFIX.length);
  if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

  const cache = getEdgeCache();
  const cacheKey = new Request(new URL(pathname, "https://cache.local").toString());
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const remember = (response: Response) => {
    if (cache) ctx.waitUntil?.(cache.put(cacheKey, response.clone()));
  };

  // 1. R2 — the new home for images.
  if (env.PRODUCT_IMAGES) {
    try {
      const obj = await env.PRODUCT_IMAGES.get(path);
      if (obj) {
        const response = new Response(obj.body, {
          status: 200,
          headers: { "content-type": obj.httpMetadata?.contentType ?? "image/jpeg", ...IMG_CACHE_HEADERS },
        });
        remember(response);
        return response;
      }
    } catch (error) {
      console.error("[img] R2 get failed for", path, error);
    }
  }

  // 2. Supabase public storage — fallback for images not yet migrated.
  const base = supabaseBaseUrl();
  if (base) {
    try {
      const upstream = await fetch(
        `${base}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
      );
      if (upstream.ok && upstream.body) {
        const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
        const bytes = await upstream.arrayBuffer();
        const response = new Response(bytes, {
          status: 200,
          headers: { "content-type": contentType, ...IMG_CACHE_HEADERS },
        });
        remember(response);
        // Lazy backfill: copy this image into R2 in the background so the
        // *next* request for it never has to touch Supabase again.
        if (env.PRODUCT_IMAGES) {
          ctx.waitUntil?.(
            env.PRODUCT_IMAGES.put(path, bytes, { httpMetadata: { contentType } }).catch((error: unknown) =>
              console.error("[img] R2 backfill failed for", path, error),
            ),
          );
        }
        return response;
      }
    } catch (error) {
      console.error("[img] Supabase fallback fetch failed for", path, error);
    }
  }

  return new Response("Not found", { status: 404 });
}

async function handleImageUpload(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.PRODUCT_IMAGES) {
    return new Response(JSON.stringify({ error: "R2 bucket not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  if (!(await requireAdminToken(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = await file.arrayBuffer();
    await env.PRODUCT_IMAGES.put(path, bytes, {
      httpMetadata: { contentType: file.type || "image/jpeg" },
    });
    return new Response(JSON.stringify({ path }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[img] upload failed", error);
    return new Response(JSON.stringify({ error: "Upload failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

async function serveLegacyAsset(pathname: string): Promise<Response> {
  const filename = decodeURIComponent(pathname.split("/").pop() ?? "");
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return new Response("Not found", { status: 404 });
  }

  const base = supabaseBaseUrl();
  if (!base) {
    console.error("[assets] SUPABASE_URL is not configured — cannot serve", pathname);
    return new Response("Storage not configured", { status: 500 });
  }

  const target = `${base}/storage/v1/object/public/${BUCKET}/${ASSET_FOLDER}/${encodeURIComponent(filename)}`;

  try {
    const upstream = await fetch(target);
    if (!upstream.ok || !upstream.body) {
      console.error(`[assets] ${filename} -> ${upstream.status} from storage`);
      return new Response("Not found", { status: 404 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[assets] fetch failed for", filename, error);
    return new Response("Not found", { status: 404 });
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname.startsWith(LEGACY_ASSET_PREFIX)) {
        return await serveLegacyAsset(pathname);
      }

      const workerEnv = (env ?? {}) as WorkerEnv;
      const workerCtx = (ctx ?? {}) as WorkerCtx;

      if (request.method === "POST" && pathname === IMG_UPLOAD_PATH) {
        return await handleImageUpload(request, workerEnv);
      }
      if (request.method === "GET" && pathname.startsWith(IMG_PREFIX) && pathname !== IMG_UPLOAD_PATH) {
        return await serveProductImage(pathname, workerEnv, workerCtx);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
