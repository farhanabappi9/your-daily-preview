export type DbProduct = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  price: number;
  old_price: number;
  stock: number;
  category_slug: string | null;
  images: string[];
  description: string;
  badge: string | null;
  active: boolean;
  featured: boolean;
  sort_order: number;
  created_at?: string;
};

export type DbCategory = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  image: string | null;
  description: string | null;
  description_en: string | null;
  sort_order: number;
  active: boolean;
};

export type DbBanner = {
  id: string;
  image: string;
  title: string | null;
  subtitle: string | null;
  link: string | null;
  sort_order: number;
  active: boolean;
};

export type DbCoupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_order: number;
  expires_at: string | null;
  active: boolean;
  used_count: number;
};

export type DbOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
};

export type OrderStatus =
  "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-neutral-200 text-neutral-800",
};

export type DbOrder = {
  id: string;
  order_no: string;
  customer_name: string;
  phone: string;
  address: string;
  note: string | null;
  area: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  tracking_note: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  order_items?: DbOrderItem[];
};

export type SizeGroupConfig = {
  key: string;
  labelBn: string;
  labelEn: string;
  options: string[];
  default?: string;
};

/** productId -> groups, or "cat:<category-slug>" -> groups */
export type SizeConfig = Record<string, SizeGroupConfig[]>;

/** Invoice document configuration, fully editable from the admin panel. */
export type InvoiceSettings = {
  prefix: string;
  showLogo: boolean;
  companyName: string;
  tagline: string;
  footerNote: string;
  terms: string;
  paymentInfo: string;
  signatureName: string;
  accentColor: string;
};

/** Storefront copy blocks the owner can edit without touching code. */
export type ContentSettings = {
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;
  heroTitle: string;
  heroSubtitle: string;
  supportHours: string;
  seoTitle: string;
  seoDescription: string;
};

export type ShopSettings = {
  name: string;
  logo?: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  facebook: string;
  instagram: string;
  /** TikTok Pixel — admin panel থেকে সেট হয়, কোডে hardcode নেই */
  tiktokPixelId?: string;
  tiktokPixelEnabled?: boolean;
  shippingInside: number;
  shippingOutside: number;
  freeShippingOver: number;
  sizeConfig?: SizeConfig;
  invoice?: Partial<InvoiceSettings>;
  content?: Partial<ContentSettings>;
};

export const DEFAULT_INVOICE: InvoiceSettings = {
  prefix: "AF",
  showLogo: true,
  companyName: "Ahsan Fashion",
  tagline: "Premium Panjabi · Saree · Couple Set",
  footerNote: "ধন্যবাদ! আপনার অর্ডারের জন্য — আবার আসবেন।",
  terms:
    "৭ দিনের মধ্যে অক্ষত পণ্য রিটার্ন/এক্সচেঞ্জ করা যাবে। ডেলিভারি চার্জ অফেরতযোগ্য। যেকোনো সমস্যায় আমাদের সাথে যোগাযোগ করুন।",
  paymentInfo: "Cash on Delivery / bKash · Nagad (Personal)",
  signatureName: "Authorized Signature",
  accentColor: "#8a1538",
};

export const DEFAULT_CONTENT: ContentSettings = {
  announcementEnabled: false,
  announcementText: "সারা দেশে হোম ডেলিভারি · ৭ দিনের রিটার্ন গ্যারান্টি",
  announcementLink: "",
  heroTitle: "",
  heroSubtitle: "",
  supportHours: "প্রতিদিন সকাল ১০টা — রাত ১০টা",
  seoTitle: "",
  seoDescription: "",
};

export const DEFAULT_SETTINGS: ShopSettings = {
  name: "Ahsan Fashion",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  facebook: "",
  instagram: "",
  tiktokPixelId: "",
  tiktokPixelEnabled: true,
  shippingInside: 70,
  shippingOutside: 130,
  freeShippingOver: 0,
  sizeConfig: {},
  invoice: DEFAULT_INVOICE,
  content: DEFAULT_CONTENT,
};

export function invoiceSettings(s?: ShopSettings | null): InvoiceSettings {
  return { ...DEFAULT_INVOICE, ...(s?.invoice ?? {}) };
}

export function contentSettings(s?: ShopSettings | null): ContentSettings {
  return { ...DEFAULT_CONTENT, ...(s?.content ?? {}) };
}