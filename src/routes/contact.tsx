import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Phone, MapPin, MessageCircle, Facebook } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Ahsan Fashion" },
      { name: "description", content: "Get in touch with Ahsan Fashion support." },
      { property: "og:title", content: "Contact Us — Ahsan Fashion" },
      { property: "og:description", content: "Contact Ahsan Fashion team." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12 animate-fade-in-up">
        <h1 className="mb-8 font-display text-4xl font-bold">{t("contact.title")}</h1>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <a
              href={CONTACT.phoneTel}
              className="flex gap-3 rounded-2xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{t("contact.phone")}</div>
                <div className="text-sm text-muted-foreground">{CONTACT.phone}</div>
              </div>
            </a>
            <a
              href={CONTACT.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 rounded-2xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">WhatsApp</div>
                <div className="text-sm text-muted-foreground">{CONTACT.phone}</div>
              </div>
            </a>
            <a
              href={CONTACT.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 rounded-2xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white">
                <Facebook className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Facebook</div>
                <div className="text-sm text-muted-foreground">facebook.com/risadahosan</div>
              </div>
            </a>
            <div className="flex gap-3 rounded-2xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{t("contact.address")}</div>
                <div className="text-sm text-muted-foreground">Mirpur, Dhaka, Bangladesh</div>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="rounded-2xl border bg-card p-6 shadow-card"
          >
            {sent ? (
              <div className="py-8 text-center animate-fade-in-up">
                <p className="mb-2 text-lg font-semibold text-primary">{t("contact.sent")}</p>
                <p className="text-sm text-muted-foreground">{t("contact.sentSub")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  required
                  placeholder={t("contact.name")}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <input
                  required
                  type="email"
                  placeholder={t("contact.emailPh")}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <textarea
                  required
                  rows={5}
                  placeholder={t("contact.msg")}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button className="w-full rounded-full bg-gradient-primary py-2.5 text-sm font-semibold text-white shadow-elegant transition hover:brightness-110">
                  {t("contact.send")}
                </button>
              </div>
            )}
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
