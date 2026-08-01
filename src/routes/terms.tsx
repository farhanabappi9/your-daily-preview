import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Ahsan Fashion" },
      { name: "description", content: "The terms and conditions of using Ahsan Fashion." },
      { property: "og:title", content: "Terms & Conditions — Ahsan Fashion" },
      { property: "og:description", content: "Read Ahsan Fashion terms of use." },
    ],
  }),
  component: Terms,
});

function Terms() {
  const { lang, t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12 animate-fade-in-up">
        <h1 className="mb-6 font-display text-4xl font-bold">{t("policy.terms")}</h1>
        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          {lang === "bn" ? (
            <>
              <p>
                Ahsan Fashion ওয়েবসাইট ব্যবহার করার মাধ্যমে আপনি নিম্নলিখিত শর্তাবলি মেনে নিচ্ছেন।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">১. অর্ডার</h2>
              <p>
                অর্ডার কনফার্মেশনের পর আমাদের প্রতিনিধি ফোনে যোগাযোগ করবেন। ভুল ঠিকানা বা মোবাইল
                নম্বর দিলে অর্ডার বাতিল হতে পারে।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">২. মূল্য ও পেমেন্ট</h2>
              <p>
                ওয়েবসাইটে প্রদর্শিত মূল্য বাংলাদেশি টাকায় (৳)। বর্তমানে ক্যাশ অন ডেলিভারি সুবিধা
                রয়েছে।
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৩. ডেলিভারি</h2>
              <p>ঢাকার ভিতরে ১-৩ কার্যদিবস এবং বাইরে ২-৫ কার্যদিবসের মধ্যে ডেলিভারি সম্পন্ন হয়।</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৪. মেধাস্বত্ব</h2>
              <p>ওয়েবসাইটের সব কনটেন্ট Ahsan Fashion-এর সম্পত্তি। অনুমতি ছাড়া ব্যবহার নিষিদ্ধ।</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">৫. পরিবর্তন</h2>
              <p>আমরা যেকোনো সময় শর্তাবলি পরিবর্তনের অধিকার রাখি।</p>
            </>
          ) : (
            <>
              <p>By using the Ahsan Fashion website you agree to the following terms.</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">1. Orders</h2>
              <p>
                After order confirmation our representative will call you. Orders with an incorrect
                address or phone number may be cancelled.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">2. Pricing & Payment</h2>
              <p>
                All prices shown are in Bangladeshi Taka (৳). Cash on Delivery is currently
                supported.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">3. Delivery</h2>
              <p>Inside Dhaka delivery in 1-3 working days, outside Dhaka in 2-5 working days.</p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">
                4. Intellectual Property
              </h2>
              <p>
                All website content is the property of Ahsan Fashion. Use without permission is
                prohibited.
              </p>
              <h2 className="pt-2 text-xl font-semibold text-foreground">5. Changes</h2>
              <p>We may revise these terms at any time.</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
