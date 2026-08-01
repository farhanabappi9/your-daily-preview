import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getProduct, type Product } from "@/lib/products";
import { formatMoney, formatNumber } from "@/lib/format";
import { useProducts } from "@/lib/products-store";
import { ProductCard } from "@/components/ProductCard";
import { useCart } from "@/lib/cart";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Check,
  Minus,
  Plus,
  RotateCcw,
  Share2,
  Shield,
  User,
  UserRound,
  ShoppingBag,
  Truck,
  Zap,
} from "lucide-react";
import { buildSrcSet, SIZES } from "@/lib/image";
import { ProductDescription } from "@/components/ProductDescription";
import { toPlainDescription } from "@/lib/description";
import { useI18n } from "@/lib/i18n";
import { resolveSizeGroups, defaultSizesFor } from "@/lib/sizes";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => {
    const p = getProduct(params.slug);
    return {
      meta: [
        { title: p ? `${p.name} — Ahsan Fashion` : "Product — Ahsan Fashion" },
        {
          name: "description",
          content: p
            ? toPlainDescription(p.description)
            : "Premium fashion product at Ahsan Fashion.",
        },
        { property: "og:title", content: p?.name ?? "Product" },
        { property: "og:description", content: p ? toPlainDescription(p.description) : "" },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="min-h-screen">
      <Header />
      <div className="p-16 text-center">Product not found</div>
      <Footer />
    </div>
  ),
  errorComponent: () => <div className="p-8 text-center">Something went wrong.</div>,
});

function ProductPageSkeleton() {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto grid max-w-6xl gap-8 p-6 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-muted" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
      <Footer />
    </div>
  );
}

function ProductPage() {
  const { slug } = Route.useParams();
  const { getBySlug, loading } = useProducts();
  const p = getBySlug(slug);
  // While the storefront query is still in flight there are no products yet —
  // throwing notFound() here would flash "Product not found" on every load.
  if (!p && loading) return <ProductPageSkeleton />;
  if (!p) throw notFound();
  return <ProductDetail p={p} />;
}

function ProductDetail({ p }: { p: Product }) {
  const { products, settings } = useProducts();
  const { t, lang } = useI18n();
  const [qty, setQty] = useState(1);

  const [tab, setTab] = useState<"desc" | "specs" | "delivery">("desc");
  const [copied, setCopied] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const gallery = p.images?.length ? p.images : [p.image];
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const navigate = useNavigate();
  const related = products
    .filter((x) => x.categorySlug === p.categorySlug && x.id !== p.id)
    .slice(0, 4);
  const discount = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
  const saved = p.oldPrice - p.price;
  const sizeGroups = useMemo(
    () => resolveSizeGroups(p, settings.sizeConfig),
    [p, settings.sizeConfig],
  );
  const [sizes, setSizes] = useState<Record<string, string>>(() => defaultSizesFor(sizeGroups));
  useEffect(() => {
    setSizes(defaultSizesFor(sizeGroups));
  }, [sizeGroups]);

  const handleAdd = () => {
    add(p, qty, sizes);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-3 py-5 pb-28 sm:px-4 sm:py-8 lg:pb-8">
        {/* Breadcrumb */}
        <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            {t("nav.home")}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/shop" className="hover:text-primary">
            {t("nav.shop")}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            to="/category/$slug"
            params={{ slug: p.categorySlug }}
            className="hover:text-primary"
          >
            {p.category}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="line-clamp-1 text-foreground">{p.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Gallery */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-muted shadow-card">
              <img
                src={gallery[activeImg] ?? p.image}
                srcSet={buildSrcSet(gallery[activeImg] ?? p.image, 900)}
                sizes={SIZES.gallery}
                alt={p.name}
                decoding="async"
                fetchPriority="high"
                width={900}
                height={1125}
                className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <span className="num absolute left-4 top-4 rounded-full bg-gradient-primary px-3 py-1.5 text-sm text-primary-foreground shadow-elegant">
                -{formatNumber(discount, lang)}%
              </span>
              <button
                onClick={handleShare}
                aria-label={t("product.share")}
                className="glass-panel absolute right-4 top-4 rounded-full border border-border/60 p-2.5 shadow-card transition hover:text-primary"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </button>
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {gallery.map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setActiveImg(i)}
                    aria-label={`Image ${i + 1}`}
                    className={`h-24 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      activeImg === i
                        ? "border-primary shadow-elegant"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <img
                      src={src}
                      srcSet={buildSrcSet(src, 500)}
                      sizes={SIZES.thumb}
                      width={80}
                      height={96}
                      decoding="async"
                      alt={`${p.name} ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { icon: Truck, label: t("product.ship") },
                { icon: Shield, label: t("product.cod") },
                { icon: RotateCcw, label: t("product.return") },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border/60 bg-card p-3 text-center shadow-card"
                >
                  <Icon className="mx-auto mb-1.5 h-4 w-4 text-primary" />
                  <p className="text-[11px] leading-snug text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              {p.category}
            </span>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
              {p.name}
            </h1>

            <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="num text-4xl text-primary">{formatMoney(p.price, lang)}</span>
                <span className="num text-lg font-medium text-muted-foreground line-through">
                  {formatMoney(p.oldPrice, lang)}
                </span>
              </div>
              <div className="mt-2 num inline-flex rounded-full bg-gradient-accent px-3 py-1 text-sm text-accent-foreground shadow">
                {t("product.youSave")} {formatMoney(saved, lang)}
              </div>
            </div>

            {/* Size selectors — per gender when the product is a couple/combo set */}
            {sizeGroups.length > 0 && (
              <div className="mt-6 space-y-4">
                {sizeGroups.map((g) => (
                  <div key={g.key}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      {g.key === "men" && <User className="h-4 w-4 text-primary" />}
                      {g.key === "women" && <UserRound className="h-4 w-4 text-primary" />}
                      {lang === "bn" ? g.labelBn : g.labelEn}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {g.options.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSizes((prev) => ({ ...prev, [g.key]: s }))}
                          className={`h-11 min-w-12 rounded-xl border px-3 text-sm font-semibold transition ${
                            sizes[g.key] === s
                              ? "border-primary bg-gradient-primary text-primary-foreground shadow-elegant"
                              : "border-input hover:border-primary/40"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity + total */}
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border/60 bg-muted/40 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 text-sm font-semibold">{t("product.qty")}</span>
                <div className="flex shrink-0 items-center rounded-xl border bg-background">
                  <button
                    aria-label="-"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="p-2.5"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="num w-12 text-center text-lg">{formatNumber(qty, lang)}</span>
                  <button
                    aria-label="+"
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    className="p-2.5"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("product.total")}
                </div>
                <div className="num text-2xl text-primary">{formatMoney(p.price * qty, lang)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleAdd}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-primary bg-background px-6 py-3.5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                {added ? t("product.added") : t("btn.addCart")}
              </button>
              <button
                onClick={() => {
                  add(p, qty, sizes);
                  navigate({ to: "/checkout" });
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Zap className="h-4 w-4" /> {t("btn.buyNow")}
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
              <div className="flex border-b">
                {(
                  [
                    ["desc", t("product.desc")],
                    ["specs", t("product.specs")],
                    ["delivery", t("product.delivery")],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`flex-1 px-3 py-3 text-xs font-semibold transition sm:text-sm ${
                      tab === k
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="p-5 text-sm leading-relaxed text-muted-foreground">
                {tab === "desc" && <ProductDescription text={p.description} />}
                {tab === "specs" && (
                  <dl className="divide-y">
                    {[
                      [t("product.sku"), `NM-${p.id.padStart(4, "0")}`],
                      [t("product.fabric"), t("product.fabricVal")],
                      [t("product.wash"), t("product.washVal")],
                      ...sizeGroups.map(
                        (g) =>
                          [lang === "bn" ? g.labelBn : g.labelEn, g.options.join(" / ")] as [
                            string,
                            string,
                          ],
                      ),
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2.5">
                        <dt>{k}</dt>
                        <dd className="text-right font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {tab === "delivery" && (
                  <ul className="space-y-2">
                    <li>
                      ✓ {t("product.deliveryTime")}:{" "}
                      <strong className="text-foreground">{t("product.deliveryTimeVal")}</strong>
                    </li>
                    <li>✓ {t("product.ship")}</li>
                    <li>✓ {t("product.cod")}</li>
                    <li>✓ {t("product.return")}</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-12 sm:mt-16">
            <h2 className="mb-5 font-display text-2xl font-bold sm:mb-6 sm:text-3xl">
              {t("product.related")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {related.map((r) => (
                <ProductCard key={r.id} p={r} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Mobile sticky buy bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 px-3 pt-3 shadow-elegant backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("product.total")}
            </div>
            <div className="num text-lg text-primary">{formatMoney(p.price * qty, lang)}</div>
          </div>
          <button
            onClick={handleAdd}
            aria-label={t("btn.addCart")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary transition active:bg-primary/10 disabled:opacity-40"
          >
            {added ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
          </button>
          <button
            onClick={() => {
              add(p, qty, sizes);
              navigate({ to: "/checkout" });
            }}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-elegant transition active:brightness-110 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> {t("btn.buyNow")}
          </button>
        </div>
      </div>

      <div className="pb-24 lg:pb-0">
        <Footer />
      </div>
    </div>
  );
}
