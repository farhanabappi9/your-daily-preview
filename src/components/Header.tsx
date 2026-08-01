import { Link, useRouter } from "@tanstack/react-router";
import {
  Search,
  User,
  ShoppingBag,
  Menu,
  X,
  Headphones,
  LayoutGrid,
  ChevronDown,
  Phone,
  MessageCircle,
  Home,
  Info,
  Store,
  Mail,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useEffect, useState } from "react";
import logoAsset from "@/assets/af-logo.jpeg.asset.json";
import { categories } from "@/lib/products";
import { useI18n } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";
import { LangToggle } from "./LangToggle";
import { useProducts } from "@/lib/products-store";
import { contentSettings } from "@/lib/shop-types";

export function Header() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [mobileCats, setMobileCats] = useState(false);
  const [q, setQ] = useState("");
  const { t, lang } = useI18n();
  const router = useRouter();
  const { settings } = useProducts();
  const content = contentSettings(settings);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setDrawer(false);
    router.navigate({ to: "/shop", search: { q: term || undefined } });
  };

  const navLinks = [
    { to: "/", label: t("nav.home"), icon: Home },
    { to: "/shop", label: t("nav.shop"), icon: Store },
    { to: "/about", label: t("nav.about"), icon: Info },
    { to: "/contact", label: t("nav.contact"), icon: Mail },
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full">
      {content.announcementEnabled && content.announcementText && (
        <div className="bg-accent px-3 py-1.5 text-center text-xs font-medium text-accent-foreground">
          {content.announcementLink ? (
            <a href={content.announcementLink} className="hover:underline">
              {content.announcementText}
            </a>
          ) : (
            content.announcementText
          )}
        </div>
      )}
      {/* Top bar */}
      <div className="bg-gradient-hero shadow-lg" style={{ color: "var(--header-fg)" }}>
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
          {/* Mobile menu button */}
          <button
            onClick={() => setDrawer(true)}
            aria-label={lang === "bn" ? "মেনু খুলুন" : "Open menu"}
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2">
            <img
              src={logoAsset.url}
              alt="Ahsan Fashion"
              className="h-9 w-9 rounded-full object-cover ring-2 ring-[color:var(--accent)]/40 sm:h-11 sm:w-11"
              width={44}
              height={44}
            />
            <span className="hidden font-display text-base font-bold tracking-wide sm:inline sm:text-lg">
              Ahsan <span className="text-accent">Fashion</span>
            </span>
          </Link>

          {/* Desktop search */}
          <form className="hidden flex-1 lg:block" onSubmit={submitSearch}>
            <div className="relative">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("nav.search")}
                aria-label={t("nav.search")}
                className="w-full rounded-full bg-background/95 px-5 py-2.5 pr-14 text-sm text-foreground shadow-inner focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <button
                aria-label={t("nav.search")}
                className="absolute right-1 top-1 flex h-9 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground transition hover:brightness-110"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-4">
            <LangToggle />
            <Link
              to="/login"
              className="hidden items-center gap-1.5 text-sm hover:text-accent lg:flex"
            >
              <User className="h-5 w-5" /> {t("nav.login")}
            </Link>
            <Link
              to="/cart"
              aria-label={t("nav.cart")}
              className="group relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-accent"
            >
              <ShoppingBag className="h-6 w-6" />
              <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-accent text-[11px] font-bold text-accent-foreground shadow ring-2 ring-[color:var(--header-bg)] transition group-hover:scale-110">
                {count}
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile search row */}
        <div className="px-3 pb-2.5 lg:hidden">
          <form onSubmit={submitSearch} className="relative">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("nav.search")}
              aria-label={t("nav.search")}
              className="w-full rounded-full bg-background/95 py-2.5 pl-4 pr-12 text-sm text-foreground shadow-inner focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              aria-label={t("nav.search")}
              className="absolute right-1 top-1 flex h-10 w-11 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Desktop nav bar */}
      <div className="hidden border-b border-border/60 bg-card/90 backdrop-blur lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110"
            >
              <LayoutGrid className="h-4 w-4" /> {t("nav.categories")}
            </button>
            {open && (
              <div className="absolute left-0 top-full z-30 mt-2 w-64 origin-top overflow-hidden rounded-xl border bg-card shadow-elegant animate-fade-in-up">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    to="/category/$slug"
                    params={{ slug: c.slug }}
                    onClick={() => setOpen(false)}
                    className="block border-b border-border/40 px-4 py-2.5 text-sm transition last:border-b-0 hover:bg-primary/5 hover:pl-6 hover:text-primary"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} className="story-link hover:text-primary">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <a
              href={CONTACT.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition hover:scale-110"
            >
              <Headphones className="h-5 w-5" />
            </a>
            <div className="leading-tight">
              <a
                href={CONTACT.phoneTel}
                className="num text-base font-bold text-primary hover:underline"
              >
                {CONTACT.phone}
              </a>
              <div className="text-xs text-muted-foreground">{t("nav.support")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile quick category strip */}
      <div className="border-b border-border/60 bg-card/95 backdrop-blur lg:hidden">
        <div className="no-scrollbar snap-strip safe-x flex items-center gap-2 overflow-x-auto px-3 py-2">
          <Link
            to="/shop"
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-gradient-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> {t("nav.shop")}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-border/70 px-3.5 py-2 text-xs font-medium transition active:border-primary active:text-primary"
            >
              {lang === "bn" ? c.name : c.nameEn}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label={lang === "bn" ? "মেনু বন্ধ করুন" : "Close menu"}
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[85%] max-w-xs flex-col overflow-y-auto bg-card shadow-elegant animate-fade-in-up">
            <div
              className="flex items-center justify-between gap-3 bg-gradient-hero px-4 py-4"
              style={{ color: "var(--header-fg)" }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <img
                  src={logoAsset.url}
                  alt="Ahsan Fashion"
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[color:var(--accent)]/40"
                />
                <span className="truncate font-display text-base font-bold">
                  Ahsan <span className="text-accent">Fashion</span>
                </span>
              </div>
              <button
                onClick={() => setDrawer(false)}
                aria-label={lang === "bn" ? "বন্ধ করুন" : "Close"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col p-3 text-sm">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setDrawer(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition active:bg-primary/10"
                >
                  <l.icon className="h-4 w-4 shrink-0 text-primary" /> {l.label}
                </Link>
              ))}

              <button
                onClick={() => setMobileCats((v) => !v)}
                aria-expanded={mobileCats}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left font-medium transition active:bg-primary/10"
              >
                <LayoutGrid className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">{t("nav.categories")}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition ${mobileCats ? "rotate-180" : ""}`}
                />
              </button>
              {mobileCats && (
                <div className="mb-1 ml-4 flex flex-col border-l border-border/60 pl-3">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      onClick={() => setDrawer(false)}
                      className="rounded-lg px-2 py-2.5 text-sm text-muted-foreground transition active:bg-primary/10 active:text-primary"
                    >
                      {lang === "bn" ? c.name : c.nameEn}
                    </Link>
                  ))}
                </div>
              )}

              <Link
                to="/cart"
                onClick={() => setDrawer(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition active:bg-primary/10"
              >
                <ShoppingBag className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">{t("nav.cart")}</span>
                <span className="num rounded-full bg-gradient-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                  {count}
                </span>
              </Link>
              <Link
                to="/login"
                onClick={() => setDrawer(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition active:bg-primary/10"
              >
                <User className="h-4 w-4 shrink-0 text-primary" /> {t("nav.login")}
              </Link>
            </nav>

            <div className="mt-auto space-y-2 border-t border-border/60 p-4 text-sm">
              <a
                href={CONTACT.phoneTel}
                className="flex items-center gap-2 font-semibold text-primary"
              >
                <Phone className="h-4 w-4 shrink-0" /> <span className="num">{CONTACT.phone}</span>
              </a>
              <a
                href={CONTACT.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <MessageCircle className="h-4 w-4 shrink-0 text-primary" /> WhatsApp
              </a>
              <p className="text-xs text-muted-foreground">{t("nav.support")}</p>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
