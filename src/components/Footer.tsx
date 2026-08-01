import { Link } from "@tanstack/react-router";
import { Facebook, MessageCircle, Phone, MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";
import logoAsset from "@/assets/af-logo.jpeg.asset.json";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer
      className="safe-x mt-14 bg-gradient-footer sm:mt-20"
      style={{ color: "var(--footer-fg)" }}
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:py-14 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <div className="mb-3 flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Ahsan Fashion logo"
              width={52}
              height={52}
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-[color:var(--accent)]/40 sm:h-[52px] sm:w-[52px]"
            />
            <h3 className="font-display text-xl font-bold sm:text-2xl">
              Ahsan <span className="text-accent">Fashion</span>
            </h3>
          </div>
          <p className="text-sm opacity-75">{t("footer.tagline")}</p>
          <div className="mt-5 flex gap-3">
            <a
              href={CONTACT.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground transition hover:scale-110"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href={CONTACT.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground transition hover:scale-110"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent sm:mb-4">
            {t("footer.quick")}
          </h4>
          <ul className="space-y-1 text-sm opacity-75">
            <li>
              <Link to="/" className="story-link inline-block py-1.5">
                {t("nav.home")}
              </Link>
            </li>
            <li>
              <Link to="/shop" className="story-link inline-block py-1.5">
                {t("nav.shop")}
              </Link>
            </li>
            <li>
              <Link to="/about" className="story-link inline-block py-1.5">
                {t("nav.about")}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="story-link inline-block py-1.5">
                {t("nav.contact")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent sm:mb-4">
            {t("footer.cs")}
          </h4>
          <ul className="space-y-1 text-sm opacity-75">
            <li>
              <Link to="/return-policy" className="story-link inline-block py-1.5">
                {t("footer.return")}
              </Link>
            </li>
            <li>
              <Link to="/return-policy" className="story-link inline-block py-1.5">
                {t("footer.shipping")}
              </Link>
            </li>
            <li>
              <Link to="/terms" className="story-link inline-block py-1.5">
                {t("footer.terms")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="story-link inline-block py-1.5">
                {t("footer.privacy")}
              </Link>
            </li>
          </ul>
        </div>
        <div className="min-w-0 sm:col-span-2 md:col-span-1">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent sm:mb-4">
            {t("footer.contact")}
          </h4>
          <ul className="space-y-1 text-sm opacity-75">
            <li>
              <a
                href={CONTACT.phoneTel}
                className="flex items-start gap-2 py-1.5 hover:text-accent"
              >
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{" "}
                <span className="num min-w-0">{CONTACT.phone}</span>
              </a>
            </li>
            <li>
              <a
                href={CONTACT.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 py-1.5 hover:text-accent"
              >
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{" "}
                <span className="min-w-0">WhatsApp: {CONTACT.phone}</span>
              </a>
            </li>
            <li>
              <a
                href={CONTACT.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 py-1.5 hover:text-accent"
              >
                <Facebook className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{" "}
                <span className="min-w-0 break-all">facebook.com/risadahosan</span>
              </a>
            </li>
            <li className="flex items-start gap-2 py-1.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{" "}
              <span className="min-w-0">Dhaka, Bangladesh</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-xs opacity-70">
          © {new Date().getFullYear()} Ahsan Fashion. {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
