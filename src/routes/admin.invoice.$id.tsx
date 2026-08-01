import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import { getOrder } from "@/lib/admin.functions";
import { getStorefront } from "@/lib/shop.functions";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/admin/invoice/$id")({
  validateSearch: z.object({ print: z.coerce.boolean().optional() }),
  component: Invoice,
});

function Invoice() {
  const { id } = Route.useParams();
  const { print } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => getOrder({ data: { id } }),
  });
  const { data: front } = useQuery({ queryKey: ["storefront"], queryFn: () => getStorefront() });

  useEffect(() => {
    if (data?.order && print !== false) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [data, print]);

  if (isLoading) return <p className="p-6 text-sm">লোড হচ্ছে…</p>;
  const order: any = data?.order;
  if (!order) return <p className="p-6 text-sm">Order পাওয়া যায়নি।</p>;

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
      <InvoiceDocument order={order} settings={front?.settings as any} />
    </div>
  );
}
