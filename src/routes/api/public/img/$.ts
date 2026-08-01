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
 */

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

const IMAGE_HEADERS = (contentType: string) => ({
  "content-type": contentType,
  "cache-control": "public, max-age=31536000, immutable",
});

export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

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
              return new Response(upstream.body, {
                status: 200,
                headers: IMAGE_HEADERS(upstream.headers.get("content-type") ?? "image/jpeg"),
              });
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
          return new Response(buf, { headers: IMAGE_HEADERS(data.type || "image/jpeg") });
        } catch (error) {
          console.error("[img] admin download failed for", path, error);
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
