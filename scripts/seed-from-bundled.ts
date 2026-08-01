/**
 * Seeds the database from the bundled catalog in src/lib/products.ts.
 * Idempotent: re-running upserts by slug.
 *
 * Usage: bun run scripts/seed-from-bundled.ts
 */
import { createClient } from "@supabase/supabase-js";
import { categories, products } from "../src/lib/products";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const db = createClient(url, key, { auth: { persistSession: false } });

const assetUrl = (v: unknown): string =>
  typeof v === "string" ? v : ((v as { url?: string })?.url ?? "");

async function main() {
  const catRows = categories.map((c, i) => ({
    slug: c.slug,
    name: c.name,
    name_en: c.nameEn,
    image: assetUrl(c.image),
    description: c.description,
    description_en: c.descriptionEn,
    sort_order: i,
    active: true,
  }));
  const cats = await db.from("categories").upsert(catRows, { onConflict: "slug" });
  if (cats.error) throw cats.error;
  console.log(`categories: ${catRows.length}`);

  const prodRows = products.map((p, i) => ({
    slug: p.slug,
    name: p.name,
    price: p.price,
    old_price: p.oldPrice,
    stock: p.stock,
    category_slug: p.categorySlug,
    images: (p.images ?? [p.image]).filter(Boolean),
    description: p.description,
    active: true,
    sort_order: i,
  }));
  for (let i = 0; i < prodRows.length; i += 50) {
    const chunk = prodRows.slice(i, i + 50);
    const res = await db.from("products").upsert(chunk, { onConflict: "slug" });
    if (res.error) throw res.error;
  }
  console.log(`products: ${prodRows.length}`);
}

main();
