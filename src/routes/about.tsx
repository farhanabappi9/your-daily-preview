import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Ahsan Fashion" },
      { name: "description", content: "Learn more about Ahsan Fashion." },
      { property: "og:title", content: "About Us — Ahsan Fashion" },
      { property: "og:description", content: "Our story and mission at Ahsan Fashion." },
    ],
  }),
  component: About,
});

function About() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12 animate-fade-in-up">
        <h1 className="mb-6 font-display text-4xl font-bold">{t("about.title")}</h1>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>{t("about.p1")}</p>
          <p>{t("about.p2")}</p>
          <p>{t("about.p3")}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { n: "10K+", l: t("about.happy") },
            { n: "500+", l: t("about.products") },
            { n: "64", l: t("about.districts") },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-card p-6 text-center shadow-card transition hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className="font-display text-4xl font-bold text-gradient">{s.n}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
