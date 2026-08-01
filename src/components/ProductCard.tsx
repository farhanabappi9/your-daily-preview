import { Link } from "@tanstack/react-router";
import type { Product } from "@/lib/products";
import { formatMoney, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { SmartImage } from "@/components/SmartImage";
import { SIZES } from "@/lib/image";
import { toPlainDescription } from "@/lib/description";

export function ProductCard({
  p,
  view = "grid",
  priority = false,
}: {
  p: Product;
  view?: "grid" | "list";
  priority?: boolean;
}) {
  const { t, lang } = useI18n();
  const { add } = useCart();
  const discount = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);

  if (view === "list") {
    return (
      <div className="group flex gap-4 rounded-2xl border border-border/60 bg-card p-3 shadow-card transition hover:shadow-elegant sm:gap-5 sm:p-4">
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="relative block aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-36"
        >
          <SmartImage
            src={p.image}
            alt={p.name}
            intrinsicWidth={500}
            sizes={SIZES.listThumb}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {p.category}
          </span>
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="mt-1 line-clamp-2 font-display text-base font-bold leading-snug transition-colors hover:text-primary sm:text-lg"
          >
            {p.name}
          </Link>
          <p className="mt-1 line-clamp-2 hidden text-sm text-muted-foreground sm:block">
            {toPlainDescription(p.description, 120)}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
            <span className="num text-xl text-primary sm:text-2xl">
              {formatMoney(p.price, lang)}
            </span>
            <span className="num text-sm font-medium text-muted-foreground line-through">
              {formatMoney(p.oldPrice, lang)}
            </span>
            <span className="num rounded-full bg-gradient-accent px-2 py-0.5 text-xs text-accent-foreground">
              -{formatNumber(discount, lang)}%
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/product/$slug"
              params={{ slug: p.slug }}
              className="btn-order flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-semibold sm:flex-none"
            >
              <span className="btn-order-label">{t("btn.order")}</span>
            </Link>
            <button
              onClick={() => add(p, 1)}
              aria-label={t("btn.addCart")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-input text-sm font-semibold transition hover:border-primary/50 hover:text-primary disabled:opacity-40"
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group hover-lift flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      <Link
        to="/product/$slug"
        params={{ slug: p.slug }}
        className="relative block aspect-[3/4] overflow-hidden bg-muted"
      >
        <SmartImage
          src={p.image}
          alt={p.name}
          priority={priority}
          width={500}
          height={750}
          sizes={SIZES.card}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="num absolute left-2 top-2 rounded-full bg-gradient-primary px-2.5 py-1 text-xs text-primary-foreground shadow">
          -{formatNumber(discount, lang)}%
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {p.category}
        </span>
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug transition-colors hover:text-primary sm:text-sm"
        >
          {p.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="num text-lg text-primary sm:text-xl">{formatMoney(p.price, lang)}</span>
          <span className="num text-[11px] font-medium text-muted-foreground line-through sm:text-xs">
            {formatMoney(p.oldPrice, lang)}
          </span>
        </div>
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="btn-order mt-3 flex min-h-11 items-center justify-center rounded-full px-3 text-center text-[13px] font-semibold sm:text-sm"
        >
          <span className="btn-order-label">{t("btn.order")}</span>
        </Link>
      </div>
    </div>
  );
}
