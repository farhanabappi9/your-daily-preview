import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getOrderReceipt, getStorefront } from "@/lib/shop.functions";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/invoice/$id")({
  head: () => ({
    meta: [
      { title: "Your Invoice — Ahsan Fashion" },
      { name: "description", content: "Download or print the invoice for your Ahsan Fashion order." },
      { property: "og:title", content: "Your Invoice — Ahsan Fashion" },
      {
        property: "og:description",
        content: "Download or print the invoice for your Ahsan Fashion order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerInvoice,
});

function CustomerInvoice() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["order-receipt", id],
    queryFn: () => getOrderReceipt({ data: { id } }),
  });
  const { data: front } = useQuery({ queryKey: ["storefront"], queryFn: () => getStorefront() });

  if (isLoading) return <p className="p-6 text-sm">লোড হচ্ছে…</p>;
  if (!data) return <p className="p-6 text-sm">Invoice পাওয়া যায়নি।</p>;

  return (
    <div className="min-h-screen bg-[#f2f2f2] py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] justify-end px-4">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Printer className="h-4 w-4" /> Print / Download PDF
        </button>
      </div>
      <InvoiceDocument order={data as any} settings={front?.settings as any} />
    </div>
  );
}
