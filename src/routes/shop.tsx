import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/lib/products";
import { useProducts } from "@/lib/products-store";
import { formatMoney, formatNumber } from "@/lib/format";
import { LayoutGrid, List, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop All Products — Ahsan Fashion" },
      {
        name: "description",
        content:
          "Browse premium sarees, panjabis, three piece sets and gift combos with cash on delivery across Bangladesh.",
      },
      { property: "og:title", content: "Shop All Products — Ahsan Fashion" },
      {
        property: "og:description",
        content:
          "Browse premium sarees, panjabis, three piece sets and gift combos with cash on delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { products } = useProducts();
  const { t, lang } = useI18n();
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");

  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "price-asc" | "price-desc" | "discount">("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const maxPriceAll = useMemo(() => Math.max(1000, ...products.map((p) => p.price)), [products]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const priceCap = maxPrice ?? maxPriceAll;

  const avgDiscount = useMemo(() => {
    if (!products.length) return 0;
    const sum = products.reduce((a, p) => a + ((p.oldPrice - p.price) / p.oldPrice) * 100, 0);
    return Math.round(sum / products.length);
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => (cat === "all" ? true : p.categorySlug === cat));
    list = list.filter((p) => p.price <= priceCap);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.category.toLowerCase().includes(s) ||
          p.description.toLowerCase().includes(s),
      );
    }
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "discount")
      list = [...list].sort(
        (a, b) => (b.oldPrice - b.price) / b.oldPrice - (a.oldPrice - a.price) / a.oldPrice,
      );
    return list;
  }, [products, q, cat, sort, priceCap]);

  const reset = () => {
    setQ("");
    setCat("all");
    setSort("newest");

    setMaxPrice(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero band */}
      <section className="border-b border-border/60 bg-gradient-hero">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <span className="inline-block rounded-full border border-primary/25 bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {t("shop.kicker")}
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-5xl">
            {t("shop.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("shop.subtitle")}
          </p>
          <dl className="mt-6 grid max-w-lg grid-cols-3 gap-3">
            {[
              { v: formatNumber(products.length, lang), l: t("shop.stat1") },
              { v: formatNumber(categories.length, lang), l: t("shop.stat2") },
              { v: `${formatNumber(avgDiscount, lang)}%`, l: t("shop.stat3") },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl border border-border/60 bg-card/70 p-3 text-center shadow-card"
              >
                <dt className="num text-2xl text-primary sm:text-3xl">{s.v}</dt>
                <dd className="mt-0.5 text-[11px] font-medium text-muted-foreground">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Filters */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  aria-expanded={filtersOpen}
                  className="flex min-w-0 items-center gap-2 text-left lg:pointer-events-none"
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
                  <h2 className="truncate text-sm font-bold uppercase tracking-wider">
                    {t("shop.filters")}
                  </h2>
                  <span
                    className={`ml-1 text-xs text-muted-foreground transition lg:hidden ${filtersOpen ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </button>
                <button
                  onClick={reset}
                  className="flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-input px-3 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <RotateCcw className="h-3 w-3" /> {t("shop.reset")}
                </button>
              </div>

              <div className={`${filtersOpen ? "block" : "hidden"} lg:block`}>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("shop.searchPh")}
                    className="w-full rounded-full border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("shop.category")}
                  </div>
                  <div className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap">
                    {[
                      { slug: "all", name: t("shop.allCat") },
                      ...categories.map((c) => ({
                        slug: c.slug,
                        name: lang === "bn" ? c.name : c.nameEn,
                      })),
                    ].map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => setCat(c.slug)}
                        className={`rounded-full px-3 py-1.5 text-left text-sm transition ${
                          cat === c.slug
                            ? "bg-gradient-primary font-semibold text-primary-foreground shadow"
                            : "border border-border/60 hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>{t("shop.priceRange")}</span>
                    <span className="num text-sm normal-case tracking-normal text-primary">
                      {formatMoney(priceCap, lang)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={maxPriceAll}
                    step={50}
                    value={priceCap}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div>
            <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-card sm:flex sm:justify-between">
              <p className="min-w-0 truncate text-sm text-muted-foreground">
                {t("shop.showing")}{" "}
                <span className="num text-base text-foreground">
                  {formatNumber(filtered.length, lang)}
                </span>{" "}
                {t("shop.of")}{" "}
                <span className="num text-base text-foreground">
                  {formatNumber(products.length, lang)}
                </span>{" "}
                {t("shop.found")}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="rounded-full border bg-background px-3 py-2 text-sm"
                  aria-label={t("shop.sortBy")}
                >
                  <option value="newest">{t("shop.newest")}</option>
                  <option value="price-asc">{t("shop.priceAsc")}</option>
                  <option value="price-desc">{t("shop.priceDesc")}</option>
                  <option value="discount">{t("shop.discountFirst")}</option>
                </select>
                <div className="hidden items-center rounded-full border p-0.5 sm:flex">
                  <button
                    aria-label={t("shop.grid")}
                    onClick={() => setView("grid")}
                    className={`rounded-full p-1.5 transition ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={t("shop.list")}
                    onClick={() => setView("list")}
                    className={`rounded-full p-1.5 transition ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">
                {t("shop.none")}
              </div>
            ) : (
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
                    : "flex flex-col gap-4"
                }
              >
                {filtered.map((p, i) => (
                  <div
                    key={p.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                  >
                    <ProductCard p={p} view={view} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
