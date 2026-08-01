import { categoryImage } from "@/lib/category-images";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/lib/products";
import { useProducts } from "@/lib/products-store";
import { HeroCarousel } from "@/components/HeroCarousel";
import { useI18n } from "@/lib/i18n";
import { Truck, ShieldCheck, RotateCcw, Headphones, ArrowUpDown } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import coverAsset from "@/assets/af-cover.jpeg.asset.json";
import { sortProducts, sortOptions, type SortKey } from "@/lib/sort";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ahsan Fashion — Premium Fashion Store" },
      {
        name: "description",
        content:
          "Featured categories, latest arrivals and deals on three piece, saree, couple sets and more.",
      },
      { property: "og:title", content: "Ahsan Fashion — Premium Fashion Store" },
      { property: "og:description", content: "Shop premium fashion at Ahsan Fashion." },
    ],
    links: [{ rel: "preload", as: "image", href: coverAsset.url, fetchPriority: "high" }],
  }),
  component: Index,
});

function Index() {
  const { products } = useProducts();
  const { t, lang } = useI18n();
  const [sort, setSort] = useState<SortKey>("popular");
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {/* Hero carousel */}
        <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4 sm:pt-6">
          <HeroCarousel />
        </section>

        {/* Trust bar */}
        <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-4 sm:pt-8">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-card md:grid-cols-4">
            {[
              { icon: Truck, label: t("product.ship") },
              { icon: ShieldCheck, label: t("product.cod") },
              { icon: RotateCcw, label: t("product.return") },
              { icon: Headphones, label: t("nav.support") + " · 01709-687389" },
            ].map(({ icon: I, label }, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white shadow">
                  <I className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium leading-snug">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Categories */}
        <section className="mx-auto max-w-7xl px-3 py-8 sm:px-4 sm:py-12">
          <div className="mb-8 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              — {t("home.featured")} —
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              {t("home.featured")}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-7">
            {categories.map((c, i) => (
              <Link
                key={c.slug}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card transition-all duration-500 hover:-translate-y-2 hover:border-primary/40 hover:shadow-elegant animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <SmartImage
                    src={categoryImage(c.slug, c.image).src}
                    srcSet={categoryImage(c.slug, c.image).srcSet || undefined}
                    alt={c.name}
                    priority={i < 4}
                    width={480}
                    height={640}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <div className="text-sm font-bold leading-tight drop-shadow">{c.name}</div>
                    <div className="mt-0.5 text-[11px] opacity-90">
                      {products.filter((p) => p.categorySlug === c.slug).length} {t("home.items")}
                    </div>
                  </div>
                  <div className="absolute inset-0 ring-0 ring-primary/0 transition group-hover:ring-4 group-hover:ring-primary/40" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Sorting toolbar */}
        <section className="mx-auto max-w-7xl px-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ArrowUpDown className="h-4 w-4 text-primary" />
              {lang === "bn" ? "প্রোডাক্ট সাজান" : "Sort products"}
            </div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {sortOptions.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setSort(o.key)}
                  aria-pressed={sort === o.key}
                  className={`flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    sort === o.key
                      ? "border-primary bg-gradient-primary text-primary-foreground shadow"
                      : "border-input hover:border-primary/50 hover:text-primary"
                  }`}
                >
                  {lang === "bn" ? o.bn : o.en}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Products by category */}
        {categories.map((c) => {
          const items = products.filter((p) => p.categorySlug === c.slug);
          if (items.length === 0) return null;
          const shown = sortProducts(items, sort).slice(0, 8);
          return (
            <section key={c.slug} className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                    {c.nameEn}
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-bold md:text-3xl">{c.name}</h2>
                </div>
                <Link
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="rounded-full border border-input px-4 py-2 text-sm font-semibold transition hover:border-primary/50 hover:text-primary"
                >
                  {lang === "bn" ? "সব দেখুন" : "View all"} ({items.length})
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {shown.map((p, i) => (
                  <div
                    key={p.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <ProductCard p={p} priority={i < 4} />
                  </div>
                ))}
              </div>
              {items.length > shown.length && (
                <div className="mt-6 text-center">
                  <Link
                    to="/category/$slug"
                    params={{ slug: c.slug }}
                    className="inline-block rounded-full bg-gradient-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:brightness-110 hover:shadow-elegant"
                  >
                    {lang === "bn" ? "আরো দেখুন" : "See more"}
                  </Link>
                </div>
              )}
            </section>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}
