import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { buildSrcSet } from "@/lib/image";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { formatMoney, formatNumber } from "@/lib/format";
import { useState } from "react";
import { Check, Lock, MapPin, ShieldCheck, Truck, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatSizes } from "@/lib/sizes";
import { useProducts } from "@/lib/products-store";
import { checkCoupon, ORDER_LIMITS, placeOrder } from "@/lib/shop.functions";

/**
 * Never show a raw validation payload to a shopper. Server functions now throw
 * Bengali sentences, but a network failure or an unexpected error can still
 * surface here — anything that looks like JSON gets replaced with plain advice.
 */
function readableOrderError(err: unknown): string {
  const fallback = "অর্ডার সম্পন্ন হয়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন, অথবা ০১৭০৯-৬৮৭৩৮৯ নম্বরে কল করুন।";
  const raw = (err as { message?: unknown })?.message;
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const message = raw.trim();
  if (message.startsWith("{") || message.startsWith("[") || message.length > 200) return fallback;
  return message;
}

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Ahsan Fashion" },
      {
        name: "description",
        content: "Complete your Ahsan Fashion order with cash on delivery anywhere in Bangladesh.",
      },
      { property: "og:title", content: "Checkout — Ahsan Fashion" },
      {
        property: "og:description",
        content: "Complete your Ahsan Fashion order with cash on delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { settings } = useProducts();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [location, setLocation] = useState<"inside" | "outside">("inside");
  const baseShipping = location === "inside" ? settings.shippingInside : settings.shippingOutside;
  const shipping =
    settings.freeShippingOver > 0 && subtotal >= settings.freeShippingOver ? 0 : baseShipping;
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const total = Math.max(0, subtotal - discount) + shipping;

  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });

  const applyCoupon = async () => {
    setCouponMsg("");
    if (!coupon.trim()) return;
    const res = await checkCoupon({ data: { code: coupon.trim(), subtotal } });
    if (res.ok) {
      setDiscount(res.discount);
      setCouponMsg(`✅ ${res.code} প্রয়োগ হয়েছে`);
    } else {
      setDiscount(0);
      setCouponMsg(res.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setOrderError("");
    try {
      const res = await placeOrder({
        data: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          note: form.note.trim(),
          area: location,
          couponCode: discount > 0 ? coupon.trim() : "",
          items: items.map(({ product, quantity, sizes }) => ({
            slug: product.slug,
            quantity,
            sizes: sizes ?? {},
          })),
        },
      });
      clear();
      navigate({ to: "/thank-you", search: { order: res.id } });
    } catch (err: any) {
      setOrderError(readableOrderError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="mb-4 font-display text-2xl font-bold">{t("cart.empty")}</p>
          <Link
            to="/shop"
            className="rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant"
          >
            {t("btn.continue")}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-4xl font-bold">{t("co.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("co.subtitle")}</p>

        <ol className="mt-6 flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
          {[t("co.step1"), t("co.step2"), t("co.step3")].map((s, i) => {
            const active = i <= 1;
            return (
              <li key={s} className="flex min-w-0 items-center gap-2">
                <span
                  className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                    active
                      ? "bg-gradient-primary text-primary-foreground shadow"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {formatNumber(i + 1, lang)}
                </span>
                <span
                  className={`truncate ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s}
                </span>
                {i < 2 && <span className="hidden h-px w-8 bg-border sm:block" />}
              </li>
            );
          })}
        </ol>

        <form
          onSubmit={handleSubmit}
          className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div className="space-y-6">
            <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <MapPin className="h-4 w-4 text-primary" /> {t("co.billing")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{t("co.name")} *</label>
                  <input
                    required
                    maxLength={ORDER_LIMITS.name}
                    placeholder={t("co.namePh")}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{t("co.phone")} *</label>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    maxLength={ORDER_LIMITS.phone}
                    placeholder={t("co.phonePh")}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={`${inputCls} num`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">{t("co.address")} *</label>
                  <textarea
                    required
                    rows={3}
                    maxLength={ORDER_LIMITS.address}
                    placeholder={t("co.addressPh")}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">{t("co.note")}</label>
                  <textarea
                    rows={2}
                    maxLength={ORDER_LIMITS.note}
                    placeholder={t("co.notePh")}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-primary" /> {t("co.safe")}
              </p>
            </section>

            <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Truck className="h-4 w-4 text-primary" /> {t("co.area")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["inside", t("co.inside"), settings.shippingInside, t("co.days1")],
                    ["outside", t("co.outside"), settings.shippingOutside, t("co.days2")],
                  ] as ["inside" | "outside", string, number, string][]
                ).map(([key, label, cost, days]) => (
                  <label
                    key={key}
                    className={`cursor-pointer rounded-2xl border-2 p-4 transition ${
                      location === key
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                        <input
                          type="radio"
                          name="area"
                          checked={location === key}
                          onChange={() => setLocation(key)}
                          className="accent-[var(--primary)]"
                        />
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="num shrink-0 text-lg text-primary">
                        {formatMoney(cost, lang)}
                      </span>
                    </div>
                    <p className="mt-1.5 pl-6 text-xs text-muted-foreground">{days}</p>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Wallet className="h-4 w-4 text-primary" /> {t("co.payment")}
              </h2>
              <div className="flex items-start gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-4 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{t("co.cod")}</span>
              </div>
            </section>
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold">{t("co.order")}</h2>
              <div className="mb-4 space-y-3 border-b pb-4">
                {items.map(({ key, product, quantity, sizes }) => (
                  <div key={key} className="flex items-center gap-3">
                    <img
                      src={product.image}
                      srcSet={buildSrcSet(product.image, 500)}
                      sizes="44px"
                      loading="lazy"
                      decoding="async"
                      alt={product.name}
                      width={44}
                      height={56}
                      className="h-14 w-11 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">{product.name}</p>
                      {sizes && Object.keys(sizes).length > 0 && (
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {formatSizes(sizes, lang)}
                        </p>
                      )}
                      <p className="num text-xs text-muted-foreground">
                        {formatNumber(quantity, lang)} × {formatMoney(product.price, lang)}
                      </p>
                    </div>
                    <span className="num shrink-0 text-sm">
                      {formatMoney(product.price * quantity, lang)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                  <span className="num text-base">{formatMoney(subtotal, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("cart.shipping")}</span>
                  <span className="num text-base">{formatMoney(shipping, lang)}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="flex gap-2">
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    placeholder="কুপন কোড"
                    className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    className="rounded-xl border px-4 text-sm font-medium"
                  >
                    Apply
                  </button>
                </div>
                {couponMsg && <p className="text-xs text-muted-foreground">{couponMsg}</p>}
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="num text-base">-{formatMoney(discount, lang)}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-base font-bold">{t("cart.total")}</span>
                <span className="num text-2xl text-primary">{formatMoney(total, lang)}</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="mt-5 disabled:opacity-60 w-full rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110"
              >
                {submitting ? "প্রসেস হচ্ছে…" : t("co.confirm")}
              </button>
              {orderError && (
                <p className="mt-2 text-center text-xs text-destructive">{orderError}</p>
              )}
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t("cart.secure")}
              </p>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
