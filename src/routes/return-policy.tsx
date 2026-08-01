import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/return-policy")({
  head: () => ({
    meta: [
      { title: "Return Policy — Ahsan Fashion" },
      { name: "description", content: "Return, refund and shipping policy of Ahsan Fashion." },
      { property: "og:title", content: "Return Policy — Ahsan Fashion" },
      { property: "og:description", content: "How returns and refunds work at Ahsan Fashion." },
    ],
  }),
  component: ReturnPolicy,
});

function ReturnPolicy() {
  const { lang, t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12 animate-fade-in-up">
        <h1 className="mb-6 font-display text-4xl font-bold">{t("policy.return")}</h1>
        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          {lang === "bn" ? (
            <>
              <p>আমাদের সব পণ্যের জন্য ৭ দিনের রিটার্ন গ্যারান্টি রয়েছে।</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">১. রিটার্নের শর্ত</h2>
              <p>
                পণ্য অক্ষত, অব্যবহৃত এবং মূল প্যাকেজিং সহ থাকতে হবে। পণ্য পাওয়ার সময়ে আনবক্সিং
                ভিডিও থাকলে দাবি দ্রুত সমাধান হয়।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">২. রিফান্ড</h2>
              <p>
                পণ্য আমাদের কাছে পৌঁছানোর পর যাচাই সাপেক্ষে ৩-৫ কার্যদিবসের মধ্যে রিফান্ড প্রদান করা
                হয়।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৩. এক্সচেঞ্জ</h2>
              <p>সাইজ সমস্যার ক্ষেত্রে ৭ দিনের মধ্যে এক্সচেঞ্জ সুবিধা রয়েছে।</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৪. শিপিং</h2>
              <p>
                ঢাকার ভিতরে ৳ ৮০ এবং বাইরে ৳ ১৫০ ডেলিভারি চার্জ প্রযোজ্য। ২,০০০ টাকার বেশি অর্ডারে
                ফ্রি শিপিং।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৫. যোগাযোগ</h2>
              <p>রিটার্ন / এক্সচেঞ্জের জন্য: 01709-687389 বা support@nmfashion.demo</p>
            </>
          ) : (
            <>
              <p>All our products come with a 7-day return guarantee.</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">1. Return Conditions</h2>
              <p>
                Product must be unused, undamaged and in its original packaging. An unboxing video,
                when available, speeds up any claim.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">2. Refunds</h2>
              <p>
                Refunds are issued within 3-5 working days of the product reaching us and passing
                inspection.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">3. Exchange</h2>
              <p>Size exchanges are available within 7 days.</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">4. Shipping</h2>
              <p>
                Delivery charge: ৳ 80 inside Dhaka, ৳ 150 outside. Free shipping on orders above ৳
                2,000.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">5. Contact</h2>
              <p>For returns / exchange: 01709-687389 or support@nmfashion.demo.</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
