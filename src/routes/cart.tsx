import { createFileRoute, Link } from "@tanstack/react-router";
import { buildSrcSet } from "@/lib/image";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { formatMoney, formatNumber } from "@/lib/format";
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatSizes } from "@/lib/sizes";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Shopping Cart — Ahsan Fashion" },
      {
        name: "description",
        content: "Review the items in your Ahsan Fashion cart before checkout.",
      },
      { property: "og:title", content: "Shopping Cart — Ahsan Fashion" },
      {
        property: "og:description",
        content: "Review the items in your Ahsan Fashion cart before checkout.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();
  const { t, lang } = useI18n();
  const count = items.reduce((a, i) => a + i.quantity, 0);
  const savings = items.reduce(
    (a, i) => a + (i.product.oldPrice - i.product.price) * i.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{t("cart.title")}</h1>
            {items.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="num text-base text-foreground">{formatNumber(count, lang)}</span>{" "}
                {t("cart.items")}
              </p>
            )}
          </div>
          <Link
            to="/shop"
            className="shrink-0 rounded-full border border-input px-4 py-2 text-sm font-semibold transition hover:border-primary/50 hover:text-primary"
          >
            {t("btn.continue")}
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border bg-card p-12 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mb-1 font-display text-2xl font-bold">{t("cart.empty")}</p>
            <p className="mb-5 text-sm text-muted-foreground">{t("cart.emptySub")}</p>
            <Link
              to="/shop"
              className="inline-block rounded-full bg-gradient-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110"
            >
              {t("btn.continue")}
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
              {items.map(({ key, product, quantity, sizes }) => (
                <div key={key} className="flex gap-3 border-b p-3 last:border-b-0 sm:gap-4 sm:p-4">
                  <Link to="/product/$slug" params={{ slug: product.slug }} className="shrink-0">
                    <img
                      src={product.image}
                      srcSet={buildSrcSet(product.image, 500)}
                      sizes="96px"
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      width={96}
                      height={120}
                      className="h-24 w-20 rounded-xl object-cover sm:h-30 sm:w-24"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {product.category}
                    </span>
                    <Link
                      to="/product/$slug"
                      params={{ slug: product.slug }}
                      className="line-clamp-2 text-sm font-semibold hover:text-primary"
                    >
                      {product.name}
                    </Link>
                    {sizes && Object.keys(sizes).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {Object.entries(sizes).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                          >
                            {formatSizes({ [k]: v }, lang)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="num text-base text-primary">
                        {formatMoney(product.price, lang)}
                      </span>
                      <span className="num text-xs font-medium text-muted-foreground line-through">
                        {formatMoney(product.oldPrice, lang)}
                      </span>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                      <div className="flex items-center rounded-xl border bg-background">
                        <button
                          aria-label="-"
                          onClick={() => setQty(key, quantity - 1)}
                          className="p-2"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="num w-10 text-center text-base">
                          {formatNumber(quantity, lang)}
                        </span>
                        <button
                          aria-label="+"
                          onClick={() => setQty(key, quantity + 1)}
                          className="p-2"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="num text-lg">
                          {formatMoney(product.price * quantity, lang)}
                        </span>
                        <button
                          aria-label={t("cart.remove")}
                          onClick={() => remove(key)}
                          className="text-muted-foreground transition hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
                <h2 className="mb-4 text-lg font-bold">{t("cart.summary")}</h2>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                    <span className="num text-base">{formatMoney(subtotal, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("cart.shipping")}</span>
                    <span className="text-xs text-muted-foreground">{t("cart.shippingCalc")}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>{t("cart.saved")}</span>
                      <span className="num text-base">{formatMoney(savings, lang)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-base font-bold">{t("cart.total")}</span>
                  <span className="num text-2xl text-primary">{formatMoney(subtotal, lang)}</span>
                </div>
                <Link
                  to="/checkout"
                  className="mt-5 block rounded-full bg-gradient-primary py-3.5 text-center text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110"
                >
                  {t("btn.checkout")}
                </Link>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t("cart.secure")}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
