import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CheckCircle2, MapPin, Package, Phone, Printer, Truck } from "lucide-react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { getOrderReceipt } from "@/lib/shop.functions";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatNumber } from "@/lib/format";

type SavedOrder = {
  orderId: string;
  form: { name: string; phone: string; address: string; note?: string };
  total: number;
  subtotal?: number;
  shipping: number;
  items: { id: string; name: string; sizeText: string; price: number; quantity: number }[];
};

/** Order items store sizes appended as "Product name (ছেলেদের: XL, মেয়েদের: M)". */
function splitSizes(raw: string): { name: string; sizeText: string } {
  const m = raw.match(/^(.*)\s\(((?:ছেলেদের|মেয়েদের|সাইজ|Men|Women|Size)\s*:[^()]*)\)$/);
  return m ? { name: m[1].trim(), sizeText: m[2].trim() } : { name: raw, sizeText: "" };
}

export const Route = createFileRoute("/thank-you")({
  validateSearch: z.object({ order: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Order Confirmed — Ahsan Fashion" },
      { name: "description", content: "Your Ahsan Fashion order has been placed successfully." },
      { property: "og:title", content: "Order Confirmed — Ahsan Fashion" },
      {
        property: "og:description",
        content: "Your Ahsan Fashion order has been placed successfully.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThankYou,
});

function ThankYou() {
  const { order } = Route.useSearch();
  const { t, lang } = useI18n();
  const { data: receipt } = useQuery({
    queryKey: ["order-receipt", order],
    queryFn: () => getOrderReceipt({ data: { id: order! } }),
    enabled: !!order,
  });

  const r: any = receipt;
  const data: SavedOrder | null = r
    ? {
        orderId: r.order_no,
        form: { name: r.customer_name, phone: r.phone, address: r.address },
        total: Number(r.total),
        subtotal: Number(r.subtotal),
        shipping: Number(r.shipping),
        items: (r.order_items ?? []).map((it: any) => ({
          id: it.id,
          name: splitSizes(it.name).name,
          sizeText: splitSizes(it.name).sizeText,
          price: Number(it.price),
          quantity: it.quantity,
        })),
      }
    : null;

  const subtotal = data?.subtotal ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 animate-fade-in-up">
        <div className="rounded-3xl border border-border/60 bg-card p-8 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary shadow-elegant">
            <CheckCircle2 className="h-11 w-11 text-primary-foreground" />
          </div>
          <span className="inline-block rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {t("ty.kicker")}
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
            {t("ty.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("ty.body")}</p>
          {order && (
            <div className="mx-auto mt-6 inline-block rounded-2xl border bg-muted/40 px-8 py-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("ty.orderId")}
              </div>
              <div className="num text-2xl text-primary">{data?.orderId ?? "…"}</div>
            </div>
          )}
        </div>

        {data && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Package className="h-4 w-4 text-primary" /> {t("ty.summary")}
              </h2>
              <div className="space-y-2.5 border-b pb-4 text-sm">
                {data.items.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="line-clamp-2 sm:line-clamp-1">{it.name}</span>
                      {it.sizeText && (
                        <span className="mt-0.5 block text-xs font-medium text-primary">
                          {it.sizeText}
                        </span>
                      )}
                      <span className="num block text-xs text-muted-foreground">
                        {formatNumber(it.quantity, lang)} × {formatMoney(it.price, lang)}
                      </span>
                    </span>
                    <span className="num shrink-0">
                      {formatMoney(it.price * it.quantity, lang)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                  <span className="num text-base">{formatMoney(subtotal, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("cart.shipping")}</span>
                  <span className="num text-base">{formatMoney(data.shipping, lang)}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary/5 px-4 py-3">
                <span className="text-sm font-bold">{t("ty.payable")}</span>
                <span className="num text-2xl text-primary">{formatMoney(data.total, lang)}</span>
              </div>
            </section>

            <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <MapPin className="h-4 w-4 text-primary" /> {t("ty.deliverTo")}
              </h2>
              <p className="text-sm font-semibold">{data.form.name}</p>
              <p className="num mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />{" "}
                {lang === "bn"
                  ? formatNumber(Number(data.form.phone.replace(/\D/g, "")) || 0, "bn")
                  : data.form.phone}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {data.form.address}
              </p>
              {data.form.note && (
                <p className="mt-2 text-xs italic text-muted-foreground">{data.form.note}</p>
              )}
            </section>

            <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <Truck className="h-4 w-4 text-primary" /> {t("ty.next")}
              </h2>
              <ol className="space-y-3 text-sm text-muted-foreground">
                {[t("ty.next1"), t("ty.next2"), t("ty.next3")].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                      {formatNumber(i + 1, lang)}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110"
          >
            {t("ty.home")}
          </Link>
          <Link
            to="/shop"
            className="rounded-full border border-input px-6 py-3 text-sm font-semibold transition hover:border-primary/50 hover:text-primary"
          >
            {t("btn.continue")}
          </Link>
          {data && order && (
            <Link
              to="/invoice/$id"
              params={{ id: order }}
              target="_blank"
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Printer className="h-4 w-4" /> Invoice download
            </Link>
          )}

        </div>
      </main>
      <Footer />
    </div>
  );
}
