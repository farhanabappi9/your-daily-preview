import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ahsan Fashion" },
      { name: "description", content: "How Ahsan Fashion collects, uses and protects your data." },
      { property: "og:title", content: "Privacy Policy — Ahsan Fashion" },
      { property: "og:description", content: "Read the Ahsan Fashion privacy policy." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  const { lang, t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12 animate-fade-in-up">
        <h1 className="mb-6 font-display text-4xl font-bold">{t("policy.privacy")}</h1>
        <div className="prose max-w-none space-y-5 text-sm leading-relaxed text-muted-foreground">
          {lang === "bn" ? (
            <>
              <p>
                Ahsan Fashion আপনার গোপনীয়তার প্রতি সম্পূর্ণ শ্রদ্ধাশীল। এই পলিসি ব্যাখ্যা করে আমরা
                কীভাবে আপনার তথ্য সংগ্রহ, ব্যবহার এবং সুরক্ষিত রাখি।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">
                ১. আমরা কী তথ্য সংগ্রহ করি
              </h2>
              <p>
                অর্ডার প্রক্রিয়াকরণের জন্য আপনার নাম, মোবাইল নম্বর, ঠিকানা ও ইমেইল সংগ্রহ করি।
                পেমেন্ট তথ্য কোনভাবেই আমাদের সার্ভারে সংরক্ষিত হয় না।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">২. তথ্যের ব্যবহার</h2>
              <p>
                সংগৃহীত তথ্য শুধুমাত্র অর্ডার ডেলিভারি, কাস্টমার সাপোর্ট এবং প্রয়োজনীয়
                নোটিফিকেশনের জন্য ব্যবহার করা হয়।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৩. তথ্যের সুরক্ষা</h2>
              <p>
                আপনার ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের সাথে শেয়ার করা হয় না। শুধুমাত্র ডেলিভারি
                পার্টনারের সাথে ডেলিভারির জন্য প্রয়োজনীয় তথ্য শেয়ার করা হতে পারে।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৪. কুকিজ</h2>
              <p>আমরা কার্ট এবং সেশন পরিচালনার জন্য ব্রাউজারের লোকাল স্টোরেজ ব্যবহার করি।</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৫. যোগাযোগ</h2>
              <p>যেকোনো প্রশ্নের জন্য: support@nmfashion.demo বা 01709-687389।</p>
            </>
          ) : (
            <>
              <p>
                Ahsan Fashion respects your privacy. This policy explains how we collect, use and
                protect your information.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">
                1. Information We Collect
              </h2>
              <p>
                To process orders we collect your name, mobile number, address and email. Payment
                details are never stored on our servers.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">
                2. How We Use Information
              </h2>
              <p>
                Collected data is used only for order delivery, customer support and necessary
                notifications.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">3. Data Protection</h2>
              <p>
                Your personal data is not shared with any third party except with delivery partners
                as required to fulfil your order.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">4. Cookies</h2>
              <p>We use browser local storage to manage your cart and session preferences.</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">5. Contact</h2>
              <p>For any question: support@nmfashion.demo or 01709-687389.</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
