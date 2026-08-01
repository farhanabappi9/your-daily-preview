import { formatBDT } from "@/lib/products";
import { invoiceSettings, type ShopSettings } from "@/lib/shop-types";
import logoAsset from "@/assets/af-logo.jpeg.asset.json";
import { CONTACT } from "@/lib/contact";

export type InvoiceOrder = {
  id: string;
  order_no: string;
  customer_name: string;
  phone: string;
  address: string;
  area?: string | null;
  note?: string | null;
  subtotal: number | string;
  shipping: number | string;
  discount: number | string;
  total: number | string;
  coupon_code?: string | null;
  status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  tracking_note?: string | null;
  created_at: string;
  order_items?: { id: string; name: string; price: number | string; quantity: number }[];
};

const money = (v: number | string | null | undefined) => formatBDT(Number(v ?? 0));

/**
 * Print-ready A4 invoice. Colors are hard-coded on purpose: this is a paper
 * document that must render identically in print preview and in PDF export,
 * independent of the site theme or dark mode.
 */
export function InvoiceDocument({
  order,
  settings,
}: {
  order: InvoiceOrder;
  settings?: ShopSettings | null;
}) {
  const inv = invoiceSettings(settings);
  const accent = inv.accentColor || "#8a1538";
  const items = order.order_items ?? [];
  const paid = (order.payment_status ?? "").toLowerCase() === "paid";
  const created = new Date(order.created_at);

  return (
    <div className="invoice-sheet mx-auto w-full max-w-[820px] bg-white text-[#1b1b1b] shadow-sm print:max-w-none print:shadow-none">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .invoice-sheet { box-shadow: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-8 pt-8">
        <div className="flex items-center gap-3">
          {inv.showLogo && (
            <img
              src={settings?.logo || logoAsset.url}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-2"
              style={{ boxShadow: `0 0 0 2px ${accent}22` }}
            />
          )}
          <div>
            <div className="text-[22px] font-extrabold leading-tight" style={{ color: accent }}>
              {inv.companyName || settings?.name || "Ahsan Fashion"}
            </div>
            <div className="text-[11px] tracking-wide text-[#666]">{inv.tagline}</div>
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-[26px] font-black uppercase leading-none tracking-[0.18em]"
            style={{ color: accent }}
          >
            Invoice
          </div>
          <div className="mt-1 text-[12px] font-semibold">
            #{inv.prefix ? `${inv.prefix}-` : ""}
            {order.order_no}
          </div>
          <div className="text-[11px] text-[#666]">
            {created.toLocaleDateString("en-GB")} · {created.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <span
            className="mt-2 inline-block rounded-full px-3 py-[3px] text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: paid ? "#e7f6ec" : "#fdf1e3",
              color: paid ? "#136c34" : "#9a5b00",
            }}
          >
            {paid ? "Paid" : "Payment due"}
          </span>
        </div>
      </div>

      <div className="mt-5 h-[3px] w-full" style={{ backgroundColor: accent }} />

      {/* Parties */}
      <div className="grid gap-4 px-8 pt-6 sm:grid-cols-3">
        <Block title="Billed to" accent={accent}>
          <p className="font-semibold">{order.customer_name}</p>
          <p>{order.phone}</p>
          <p className="whitespace-pre-line text-[#555]">{order.address}</p>
          {order.area && <p className="text-[#555]">এলাকা: {order.area}</p>}
        </Block>
        <Block title="From" accent={accent}>
          <p className="font-semibold">{inv.companyName || settings?.name}</p>
          {(settings?.phone || CONTACT.phone) && <p>📞 {settings?.phone || CONTACT.phone}</p>}
          {settings?.email && <p>✉️ {settings.email}</p>}
          {settings?.address && <p className="whitespace-pre-line text-[#555]">{settings.address}</p>}
        </Block>
        <Block title="Order details" accent={accent}>
          <Line k="Payment" v={order.payment_method ?? "COD"} />
          <Line k="Status" v={order.status ?? "pending"} />
          {order.coupon_code && <Line k="Coupon" v={order.coupon_code} />}
          {order.tracking_note && <Line k="Courier" v={order.tracking_note} />}
        </Block>
      </div>

      {/* Items */}
      <div className="px-8 pt-6">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr style={{ backgroundColor: accent, color: "#fff" }}>
              <th className="p-2 text-left font-semibold">#</th>
              <th className="p-2 text-left font-semibold">Item description</th>
              <th className="p-2 text-center font-semibold">Qty</th>
              <th className="p-2 text-right font-semibold">Unit price</th>
              <th className="p-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className={i % 2 ? "bg-[#faf7f8]" : ""}>
                <td className="border-b border-[#eee] p-2 text-[#777]">{i + 1}</td>
                <td className="border-b border-[#eee] p-2">{it.name}</td>
                <td className="border-b border-[#eee] p-2 text-center">{it.quantity}</td>
                <td className="border-b border-[#eee] p-2 text-right">{money(it.price)}</td>
                <td className="border-b border-[#eee] p-2 text-right font-medium">
                  {money(Number(it.price) * it.quantity)}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-[#888]">
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex flex-wrap justify-between gap-6 px-8 pt-5">
        <div className="max-w-[330px] space-y-3 text-[11px] text-[#555]">
          {inv.paymentInfo && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                Payment
              </p>
              <p className="whitespace-pre-line">{inv.paymentInfo}</p>
            </div>
          )}
          {order.note && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                Customer note
              </p>
              <p className="whitespace-pre-line">{order.note}</p>
            </div>
          )}
        </div>
        <div className="ml-auto w-[260px] text-[12px]">
          <TotalRow k="Subtotal" v={money(order.subtotal)} />
          {Number(order.discount) > 0 && (
            <TotalRow k="Discount" v={`- ${money(order.discount)}`} />
          )}
          <TotalRow k="Delivery charge" v={money(order.shipping)} />
          <div
            className="mt-2 flex items-center justify-between rounded-md px-3 py-2 text-[15px] font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Terms + signature */}
      <div className="mt-8 grid gap-6 px-8 sm:grid-cols-[1fr_auto]">
        {inv.terms && (
          <div className="text-[10px] leading-relaxed text-[#666]">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
              Terms & conditions
            </p>
            <p className="whitespace-pre-line">{inv.terms}</p>
          </div>
        )}
        <div className="self-end text-center">
          <div className="mb-1 h-10 w-44 border-b border-dashed border-[#aaa]" />
          <p className="text-[10px] text-[#666]">{inv.signatureName}</p>
        </div>
      </div>

      <div className="mt-8 border-t px-8 py-4 text-center text-[11px] text-[#666]">
        <p className="font-medium">{inv.footerNote}</p>
        <p className="mt-1">
          {[settings?.phone || CONTACT.phone, settings?.email, settings?.address]
            .filter(Boolean)
            .join("  ·  ")}
        </p>
      </div>
    </div>
  );
}

function Block({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#eee] bg-[#fbfafa] p-3 text-[11px] leading-relaxed">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="text-[#777]">{k}</span>
      <span className="font-medium capitalize">{v}</span>
    </p>
  );
}

function TotalRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-[#e6e6e6] py-[6px]">
      <span className="text-[#666]">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
