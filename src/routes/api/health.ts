import { createFileRoute } from "@tanstack/react-router";

/**
 * Live diagnostics endpoint: GET /api/health
 *
 * Answers, in one request, the three questions that matter when the storefront
 * renders empty:
 *   1. Did the deployed build actually get Supabase credentials?
 *   2. Can the anon/publishable key read the tables (RLS + GRANTs OK)?
 *   3. Are there any rows at all, and what do the image URLs look like?
 *
 * Returns booleans and counts only — never a key value.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        const { credentialsDiagnostics, publicClient } = await import("@/lib/shop.server");

        const config = credentialsDiagnostics();
        const body: Record<string, unknown> = {
          ok: false,
          checkedAt: new Date().toISOString(),
          config,
        };

        try {
          const db = publicClient();

          const [products, categories, banners, settings] = await Promise.all([
            db.from("products").select("slug, images, active", { count: "exact" }).limit(3),
            db.from("categories").select("slug, image", { count: "exact" }).limit(3),
            db.from("banners").select("id", { count: "exact" }).limit(1),
            db.from("settings").select("key").eq("key", "shop").maybeSingle(),
          ]);

          body.database = {
            products: {
              count: products.count ?? 0,
              error: products.error?.message ?? null,
              sample: (products.data ?? []).map((p: any) => ({
                slug: p.slug,
                active: p.active,
                firstImage: p.images?.[0] ?? null,
              })),
            },
            categories: {
              count: categories.count ?? 0,
              error: categories.error?.message ?? null,
              sample: (categories.data ?? []).map((c: any) => ({
                slug: c.slug,
                image: c.image,
              })),
            },
            banners: { count: banners.count ?? 0, error: banners.error?.message ?? null },
            shopSettingsRow: Boolean(settings.data),
          };

          body.ok =
            !products.error &&
            !categories.error &&
            (products.count ?? 0) > 0 &&
            (categories.count ?? 0) > 0;
        } catch (e: any) {
          body.error = String(e?.message ?? e);
        }

        body.tookMs = Date.now() - started;

        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
