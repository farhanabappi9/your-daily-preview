import { createFileRoute } from "@tanstack/react-router";

/**
 * Serves images uploaded through the admin panel: /api/public/img/<path>
 *
 * Previously this always went through the service-role client, which meant a
 * missing SUPABASE_SERVICE_ROLE_KEY silently turned every admin-uploaded image
 * into a 404. The `product-images` bucket is public, so we now hit the public
 * storage URL first (fast, CDN-cacheable, no secret needed) and only fall back
 * to the authenticated download when that fails — which covers the case where
 * the bucket was created private.
 *
 * Edge caching (added 2026-09-03):
 * Every hit used to go straight to Supabase Storage, with zero caching on our
 * side — only a `cache-control` header for the visitor's own browser. That
 * meant every unique visitor, and every repeat visitor with an empty cache,
 * re-pulled the full image from Supabase, which is billed as Supabase
 * "Cached Egress". This is what blew through the 5GB/month free quota in two
 * days. We now check Cloudflare's own edge cache (`caches.default`) first —
 * a request for the same path from the same edge location is served straight
 * from Cloudflare, at zero Supabase egress, instead of going upstream again.
 */

const BUCKET = "product-images";
const EDGE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days at Cloudflare's edge

function getEdgeCache(): Cache | undefined {
  const c = (globalThis as unknown as { caches?: { default?: Cache } }).caches;
  return c?.default;
}

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

const IMAGE_HEADERS = (contentType: string) => ({
  "content-type": contentType,
  "cache-control": "public, max-age=31536000, immutable",
  // Also tells Cloudflare's edge (and any CDN in front of it) how long it's
  // allowed to hold this in its own cache, independent of caches.default.
  "cdn-cache-control": `public, max-age=${EDGE_CACHE_TTL_SECONDS}`,
});

export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

        const edgeCache = getEdgeCache();
        // Normalize the cache key so query strings / origins don't fragment it.
        const cacheKey = new Request(new URL(`/api/public/img/${path}`, request.url).toString(), {
          method: "GET",
        });

        if (edgeCache) {
          const cached = await edgeCache.match(cacheKey);
          if (cached) return cached;
        }

        const putInEdgeCache = async (response: Response) => {
          if (!edgeCache) return;
          try {
            await edgeCache.put(cacheKey, response.clone());
          } catch (error) {
            // Never let a cache-write failure break serving the image.
            console.error("[img] edge cache put failed for", path, error);
          }
        };

        // 1. Public bucket URL — no credentials required.
        const base = supabaseBaseUrl();
        if (base) {
          try {
            const upstream = await fetch(
              `${base}/storage/v1/object/public/${BUCKET}/${path
                .split("/")
                .map(encodeURIComponent)
                .join("/")}`,
            );
            if (upstream.ok && upstream.body) {
              const response = new Response(upstream.body, {
                status: 200,
                headers: IMAGE_HEADERS(upstream.headers.get("content-type") ?? "image/jpeg"),
              });
              await putInEdgeCache(response);
              return response;
            }
          } catch (error) {
            console.error("[img] public fetch failed for", path, error);
          }
        }

        // 2. Authenticated download — needed only for a private bucket.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await (supabaseAdmin as any).storage.from(BUCKET).download(path);
          if (error || !data) {
            console.error("[img] not found:", path, error?.message ?? "");
            return new Response("Not found", { status: 404 });
          }
          const buf = await data.arrayBuffer();
          const response = new Response(buf, { headers: IMAGE_HEADERS(data.type || "image/jpeg") });
          await putInEdgeCache(response);
          return response;
        } catch (error) {
          console.error("[img] admin download failed for", path, error);
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
