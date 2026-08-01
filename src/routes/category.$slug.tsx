import { categoryImage } from "@/lib/category-images";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/lib/products";
import { useProducts } from "@/lib/products-store";
import { SmartImage } from "@/components/SmartImage";
import { sortProducts, sortOptions, type SortKey } from "@/lib/sort";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const cat = categories.find((c) => c.slug === params?.slug);
    const title = cat ? `${cat.nameEn} (${cat.name}) — Ahsan Fashion` : "Category — Ahsan Fashion";
    const desc = cat?.descriptionEn ?? `Browse products in ${params?.slug} at Ahsan Fashion.`;
    const image = cat?.image;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `/category/${params?.slug}` },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `/category/${params?.slug}` }],
    };
  },
  component: Category,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Category not found</h1>
      </div>
      <Footer />
    </div>
  ),
  errorComponent: () => <div className="p-8 text-center">Something went wrong.</div>,
});

function Category() {
  const { slug } = Route.useParams();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) throw notFound();
  const { products } = useProducts();
  const { lang } = useI18n();
  const all = useMemo(() => products.filter((p) => p.categorySlug === slug), [products, slug]);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const priceBands = useMemo(() => {
    const top = all.reduce((m, p) => Math.max(m, p.price), 0);
    const bands = [500, 800, 1000, 1500, 2000, 3000].filter((b) => b < top);
    return bands;
  }, [all]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (needle && !`${p.name} ${p.description} ${p.slug}`.toLowerCase().includes(needle))
        return false;
      if (maxPrice !== null && p.price > maxPrice) return false;
      return true;
    });
    return sortProducts(filtered, sort);
  }, [all, q, maxPrice, sort]);

  const hasFilters = q !== "" || maxPrice !== null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8">
        <section className="mb-6 overflow-hidden rounded-2xl border shadow-elegant sm:mb-8 sm:rounded-3xl">
          <div className="relative aspect-[16/9] w-full sm:aspect-[16/7] lg:aspect-[16/5]">
            <SmartImage
              src={categoryImage(cat.slug, cat.image).src}
              srcSet={categoryImage(cat.slug, cat.image).srcSet || undefined}
              alt={cat.name}
              priority
              width={900}
              height={900}
              sizes="100vw"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
            <div className="absolute inset-0 flex flex-col justify-center gap-1.5 p-4 text-white sm:gap-2 sm:p-6 md:p-10">
              <div className="text-[10px] font-semibold uppercase tracking-[0.3em] opacity-90 sm:text-xs">
                Category
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight drop-shadow sm:text-3xl md:text-5xl">
                {cat.name}
              </h1>
              <p className="line-clamp-2 max-w-2xl text-xs opacity-95 sm:line-clamp-none sm:text-sm md:text-base">
                {cat.description}
              </p>
              <div className="num text-[11px] opacity-90 sm:text-xs">{all.length} products</div>
            </div>
          </div>
        </section>

        {/* Search + filters */}
        <section className="mb-6 space-y-4 rounded-2xl border bg-card p-3 shadow-card sm:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  lang === "bn"
                    ? "এই ক্যাটাগরিতে প্রোডাক্ট খুঁজুন..."
                    : "Search products in this category..."
                }
                aria-label={lang === "bn" ? "প্রোডাক্ট সার্চ" : "Search products"}
                className="w-full rounded-full border border-input bg-background py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-primary/60"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label={lang === "bn" ? "সাজান" : "Sort"}
              className="rounded-full border border-input bg-background px-4 py-2.5 text-sm font-semibold outline-none transition focus:border-primary/60"
            >
              {sortOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {lang === "bn" ? o.bn : o.en}
                </option>
              ))}
            </select>
          </div>

          <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <button
              onClick={() => setMaxPrice(null)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${maxPrice === null ? "border-primary bg-gradient-primary text-primary-foreground" : "border-input hover:border-primary/50"}`}
            >
              {lang === "bn" ? "সব দাম" : "All prices"}
            </button>
            {priceBands.map((b) => (
              <button
                key={b}
                onClick={() => setMaxPrice(b)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${maxPrice === b ? "border-primary bg-gradient-primary text-primary-foreground" : "border-input hover:border-primary/50"}`}
              >
                {lang === "bn" ? `৳${b} পর্যন্ত` : `Under ৳${b}`}
              </button>
            ))}
            {hasFilters && (
              <button
                onClick={() => {
                  setQ("");
                  setMaxPrice(null);
                }}
                className="shrink-0 whitespace-nowrap text-xs font-semibold text-primary sm:ml-auto underline-offset-4 hover:underline"
              >
                {lang === "bn" ? "ফিল্টার মুছুন" : "Clear filters"}
              </button>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            {lang === "bn"
              ? `${items.length} টি প্রোডাক্ট দেখানো হচ্ছে`
              : `Showing ${items.length} products`}
          </div>
        </section>

        {items.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {all.length === 0
              ? lang === "bn"
                ? "এই ক্যাটাগরিতে এখনো কোন পণ্য নেই।"
                : "No products in this category yet."
              : lang === "bn"
                ? "আপনার সার্চ/ফিল্টারে কোন প্রোডাক্ট পাওয়া যায়নি।"
                : "No products matched your search or filters."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((p, i) => (
              <div
                key={p.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <ProductCard p={p} priority={i < 4} />
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
