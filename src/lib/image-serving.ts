/**
 * One place that knows how to find an image, no matter where it currently lives.
 *
 * BACKGROUND — why images disappeared
 * -----------------------------------
 * This project has been moved between three different Supabase projects:
 *   1. ldsnvxmaghkeinfjkpqz   (original — `scripts/migrate-assets-to-supabase.mjs`
 *                              uploaded the bundled catalog here, under
 *                              product-images/catalog/<filename>)
 *   2. xvxmydbhhpxiemmpahzo
 *   3. fpmeidfyupqunuwtynso   (current)
 *
 * The database rows were carried across with a SQL export. Supabase Storage
 * objects were NOT — a SQL dump does not contain the storage bucket. So on the
 * current project the `product-images` bucket is empty (or missing), while the
 * `products.images` and `categories.image` columns still point at files that
 * only ever existed in projects #1 and #2.
 *
 * On top of that, R2 was added as the new home for images, but the binding was
 * never actually reachable (see src/lib/worker-runtime.ts), so nothing was ever
 * written to it either. Result: every single image 404s.
 *
 * WHAT THIS FILE DOES
 * -------------------
 * `resolveImage()` tries every plausible origin in order and, the moment one
 * of them answers, copies the bytes into R2 so the next request is served from
 * R2 alone — permanently, at zero Supabase egress. That means the site
 * self-heals as visitors browse, as long as at least one origin still works.
 *
 * Origins tried, in order:
 *   1. R2 (`PRODUCT_IMAGES`)                     — the permanent home
 *   2. current Supabase public bucket URL
 *   3. current Supabase authenticated download   (service-role, private bucket)
 *   4. every origin in `LEGACY_IMAGE_ORIGINS`    — the OLD Supabase projects
 *   5. `LOVABLE_ORIGIN` at the original path     — recovers /__l5e/ catalog art
 *
 * Nothing found -> an inline SVG placeholder with a short cache lifetime, so a
 * missing image never shows a broken-image icon and never gets cached forever.
 */

import { getProductImagesBucket, getWaitUntil, getEdgeCache, getWorkerEnv } from "./worker-runtime";

export const BUCKET = "product-images";
export const LEGACY_ASSET_PREFIX = "/__l5e/assets-v1/";
export const IMG_PREFIX = "/api/public/img/";
export const IMG_UPLOAD_PATH = "/api/public/img/upload";
/** Where the bundled catalog art lives inside the bucket. */
export const ASSET_FOLDER = "catalog";

const IMMUTABLE_HEADERS = {
  "cache-control": "public, max-age=31536000, immutable",
  "cdn-cache-control": "public, max-age=2592000",
};

/* ------------------------------------------------------------------ *
 * Key normalisation
 * ------------------------------------------------------------------ */

/**
 * Turn any request path into the single object key we store under.
 *
 *   /api/public/img/1787076447584-dxheg0.png   ->  1787076447584-dxheg0.png
 *   /api/public/img/catalog/af-logo.jpeg       ->  catalog/af-logo.jpeg
 *   /__l5e/assets-v1/<uuid>/af-logo.jpeg       ->  catalog/af-logo.jpeg
 *
 * The asset UUID in the legacy path is deliberately discarded: several
 * different UUIDs point at the same filename, and the filename is what the
 * migration script uploaded under.
 */
export function objectKeyFromPath(pathname: string): string | null {
  let raw: string;

  if (pathname.startsWith(LEGACY_ASSET_PREFIX)) {
    const filename = decodeURIComponent(pathname.split("/").pop() ?? "");
    if (!filename) return null;
    raw = `${ASSET_FOLDER}/${filename}`;
  } else if (pathname.startsWith(IMG_PREFIX)) {
    raw = decodeURIComponent(pathname.slice(IMG_PREFIX.length));
  } else {
    return null;
  }

  if (!raw || raw.includes("..") || raw.startsWith("/")) return null;
  return raw;
}

/** The candidate keys to look for, most likely first. */
function candidateKeys(key: string): string[] {
  const keys = [key];
  // A bare filename may also have been stored under catalog/.
  if (!key.includes("/")) keys.push(`${ASSET_FOLDER}/${key}`);
  // ...and vice versa.
  if (key.startsWith(`${ASSET_FOLDER}/`)) keys.push(key.slice(ASSET_FOLDER.length + 1));
  return [...new Set(keys)];
}

/* ------------------------------------------------------------------ *
 * Origins
 * ------------------------------------------------------------------ */

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export function currentSupabaseUrl(env = getWorkerEnv()): string | undefined {
  let baked: string | undefined;
  try {
    baked = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  } catch {
    /* import.meta.env unavailable in this runtime */
  }
  const url = baked || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  return url ? trimSlash(url) : undefined;
}

export function serviceRoleKey(env = getWorkerEnv()): string | undefined {
  return env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

/** Old Supabase projects (or any other https origin) to fall back to. */
export function legacyOrigins(env = getWorkerEnv()): string[] {
  const raw = (env.LEGACY_IMAGE_ORIGINS as string | undefined) ?? "";
  return raw
    .split(",")
    .map((s) => trimSlash(s.trim()))
    .filter((s) => s.startsWith("http"));
}

export function lovableOrigin(env = getWorkerEnv()): string | undefined {
  const raw = env.LOVABLE_ORIGIN as string | undefined;
  return raw ? trimSlash(raw) : undefined;
}

function publicStorageUrl(origin: string, key: string) {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${origin}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

function authedStorageUrl(origin: string, key: string) {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${origin}/storage/v1/object/${BUCKET}/${encoded}`;
}

/* ------------------------------------------------------------------ *
 * Placeholder
 * ------------------------------------------------------------------ */

/** A neutral, on-brand SVG so a missing file never renders as a broken icon. */
export function placeholderResponse(label = "Ahsan Fashion", status = 200): Response {
  const safe = label.replace(/[<>&"']/g, "").slice(0, 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800" role="img" aria-label="${safe}">
  <rect width="600" height="800" fill="#f6efe6"/>
  <rect x="1" y="1" width="598" height="798" fill="none" stroke="#e3d5c2" stroke-width="2"/>
  <g fill="#b9a891" text-anchor="middle" font-family="system-ui,-apple-system,'Segoe UI',sans-serif">
    <circle cx="300" cy="352" r="58" fill="none" stroke="#d9c7b0" stroke-width="6"/>
    <path d="M272 352a28 28 0 0 1 56 0" fill="none" stroke="#d9c7b0" stroke-width="6"/>
    <text x="300" y="460" font-size="26" font-weight="600">${safe}</text>
    <text x="300" y="496" font-size="19">ছবি পাওয়া যায়নি</text>
  </g>
</svg>`;
  return new Response(svg, {
    status,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Deliberately short: the real image may be restored at any moment.
      "cache-control": "public, max-age=60",
      "x-img-source": "placeholder",
    },
  });
}

/* ------------------------------------------------------------------ *
 * The resolver
 * ------------------------------------------------------------------ */

type ResolveOptions = {
  env?: unknown;
  ctx?: unknown;
  request?: Request;
  /** Original pathname, needed to retry `/__l5e/` paths against Lovable. */
  pathname?: string;
  /** Alt text used on the placeholder. */
  label?: string;
};

async function fetchFrom(url: string, headers?: Record<string, string>) {
  try {
    const res = await fetch(url, headers ? { headers } : undefined);
    if (res.ok && res.body) return res;
  } catch {
    /* network error — try the next origin */
  }
  return null;
}

/**
 * Find `key` and return a Response.
 *
 * Always resolves — worst case it is the placeholder, never a broken image.
 * Every successful non-R2 hit is copied into R2 in the background.
 */
export async function resolveImage(key: string, options: ResolveOptions = {}): Promise<Response> {
  const { request, pathname, label } = options;
  const env = getWorkerEnv(options.env, request);
  const bucket = getProductImagesBucket(options.env, request);
  const waitUntil = getWaitUntil(options.ctx, request);
  const keys = candidateKeys(key);

  const cache = getEdgeCache();
  const cacheKey = new Request(new URL(`/__img/${key}`, "https://img.cache.local").toString());
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    } catch {
      /* cache unavailable */
    }
  }

  const finish = (body: BodyInit, contentType: string, source: string) => {
    const response = new Response(body, {
      status: 200,
      headers: { "content-type": contentType, ...IMMUTABLE_HEADERS, "x-img-source": source },
    });
    if (cache) waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  };

  const backfill = (bytes: ArrayBuffer, contentType: string) => {
    if (!bucket) return;
    waitUntil(
      Promise.resolve(bucket.put(keys[0], bytes, { httpMetadata: { contentType } })).catch(
        (error: unknown) => console.error("[img] R2 backfill failed for", keys[0], error),
      ),
    );
  };

  /* 1. R2 — the permanent home. */
  if (bucket) {
    for (const candidate of keys) {
      try {
        const object = await bucket.get(candidate);
        if (object) {
          const response = new Response(object.body, {
            status: 200,
            headers: {
              "content-type": object.httpMetadata?.contentType ?? guessContentType(candidate),
              ...IMMUTABLE_HEADERS,
              "x-img-source": "r2",
            },
          });
          if (cache) waitUntil(cache.put(cacheKey, response.clone()));
          return response;
        }
      } catch (error) {
        console.error("[img] R2 get failed for", candidate, error);
      }
    }
  }

  /* 2 + 3. Current Supabase project: public URL, then service-role download. */
  const origins: Array<{ origin: string; authed: boolean }> = [];
  const current = currentSupabaseUrl(env);
  if (current) origins.push({ origin: current, authed: false }, { origin: current, authed: true });
  /* 4. Old Supabase projects — where the files actually still are. */
  for (const origin of legacyOrigins(env)) origins.push({ origin, authed: false });

  const key2 = serviceRoleKey(env);
  for (const { origin, authed } of origins) {
    if (authed && !key2) continue;
    for (const candidate of keys) {
      const url = authed ? authedStorageUrl(origin, candidate) : publicStorageUrl(origin, candidate);
      const headers = authed ? { apikey: key2!, Authorization: `Bearer ${key2}` } : undefined;
      const upstream = await fetchFrom(url, headers);
      if (!upstream) continue;
      const contentType = upstream.headers.get("content-type") ?? guessContentType(candidate);
      const bytes = await upstream.arrayBuffer();
      backfill(bytes, contentType);
      return finish(bytes, contentType, authed ? "supabase-authed" : `supabase:${hostOf(origin)}`);
    }
  }

  /* 5. Lovable preview host, at the original untouched path. */
  const lovable = lovableOrigin(env);
  if (lovable && pathname?.startsWith(LEGACY_ASSET_PREFIX)) {
    const upstream = await fetchFrom(`${lovable}${pathname}`);
    if (upstream) {
      const contentType = upstream.headers.get("content-type") ?? guessContentType(key);
      const bytes = await upstream.arrayBuffer();
      backfill(bytes, contentType);
      return finish(bytes, contentType, "lovable");
    }
  }

  console.error("[img] not found in any origin:", key);
  return placeholderResponse(label ?? "Ahsan Fashion");
}

function hostOf(origin: string) {
  try {
    return new URL(origin).hostname.split(".")[0];
  } catch {
    return "unknown";
  }
}

export function guessContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    default:
      return "image/jpeg";
  }
}
