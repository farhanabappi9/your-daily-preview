import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DbBanner, DbCategory, DbProduct, ShopSettings } from "./shop-types";
import { DEFAULT_SETTINGS } from "./shop-types";
import { publicClient } from "./shop.server";

export const getStorefront = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicClient();
  const [products, categories, banners, settings] = await Promise.all([
    db.from("products").select("*").eq("active", true).order("sort_order", { ascending: true }),
    db.from("categories").select("*").eq("active", true).order("sort_order", { ascending: true }),
    db.from("banners").select("*").eq("active", true).order("sort_order", { ascending: true }),
    db.from("settings").select("value").eq("key", "shop").maybeSingle(),
  ]);
  return {
    products: (products.data ?? []) as DbProduct[],
    categories: (categories.data ?? []) as DbCategory[],
    banners: (banners.data ?? []) as DbBanner[],
    settings: {
      ...DEFAULT_SETTINGS,
      ...((settings.data?.value ?? {}) as Partial<ShopSettings>),
    } as ShopSettings,
  };
});

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const db = publicClient();
    const { data: row } = await db
      .from("products")
      .select("*")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    return (row ?? null) as DbProduct | null;
  });

export const checkCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; subtotal: number }) =>
    z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().min(0) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = publicClient();
    const { data: c } = await db
      .from("coupons")
      .select("*")
      .ilike("code", data.code)
      .eq("active", true)
      .maybeSingle();
    if (!c) return { ok: false as const, message: "কুপন কোড সঠিক নয়" };
    if (c.expires_at && new Date(c.expires_at) < new Date())
      return { ok: false as const, message: "কুপনের মেয়াদ শেষ" };
    if (Number(data.subtotal) < Number(c.min_order))
      return { ok: false as const, message: `সর্বনিম্ন অর্ডার ৳${c.min_order}` };
    const discount =
      c.type === "percent"
        ? Math.round((Number(data.subtotal) * Number(c.value)) / 100)
        : Math.round(Number(c.value));
    return {
      ok: true as const,
      code: c.code as string,
      discount: Math.min(discount, Number(data.subtotal)),
    };
  });

const SIZE_LABEL: Record<string, string> = { men: "ছেলেদের", women: "মেয়েদের", size: "সাইজ" };
const sizeSuffix = (sizes?: Record<string, string>) =>
  Object.entries(sizes ?? {})
    .map(([k, v]) => `${SIZE_LABEL[k] ?? k}: ${v}`)
    .join(", ");

const orderInput = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(20),
  address: z.string().trim().min(5).max(500),
  note: z.string().trim().max(500).optional().default(""),
  area: z.enum(["inside", "outside"]),
  couponCode: z.string().trim().max(40).optional().default(""),
  items: z
    .array(
      z.object({
        slug: z.string().max(200),
        quantity: z.number().int().min(1).max(50),
        sizes: z.record(z.string().max(20), z.string().max(30)).optional().default({}),
      }),
    )
    .min(1)
    .max(50),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof orderInput>) => orderInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const slugs = data.items.map((i) => i.slug);
    const { data: products } = await db
      .from("products")
      .select("*")
      .in("slug", slugs)
      .eq("active", true);
    const list = (products ?? []) as DbProduct[];
    if (!list.length) throw new Error("No valid products in order");

    const items = data.items
      .map((i) => {
        const p = list.find((x) => x.slug === i.slug);
        if (!p) return null;
        return {
          product_id: p.id,
          name: sizeSuffix(i.sizes) ? `${p.name} (${sizeSuffix(i.sizes)})` : p.name,
          price: Number(p.price),
          quantity: i.quantity,
          image: p.images?.[0] ?? null,
        };
      })
      .filter(Boolean) as {
      product_id: string;
      name: string;
      price: number;
      quantity: number;
      image: string | null;
    }[];

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

    const { data: settingRow } = await db
      .from("settings")
      .select("value")
      .eq("key", "shop")
      .maybeSingle();
    const settings = {
      ...DEFAULT_SETTINGS,
      ...((settingRow?.value ?? {}) as Partial<ShopSettings>),
    };
    let shipping =
      data.area === "inside" ? Number(settings.shippingInside) : Number(settings.shippingOutside);
    if (settings.freeShippingOver > 0 && subtotal >= settings.freeShippingOver) shipping = 0;

    let discount = 0;
    let couponCode: string | null = null;
    if (data.couponCode) {
      const { data: c } = await db
        .from("coupons")
        .select("*")
        .ilike("code", data.couponCode)
        .eq("active", true)
        .maybeSingle();
      if (
        c &&
        (!c.expires_at || new Date(c.expires_at) >= new Date()) &&
        subtotal >= Number(c.min_order)
      ) {
        discount = Math.min(
          c.type === "percent"
            ? Math.round((subtotal * Number(c.value)) / 100)
            : Math.round(Number(c.value)),
          subtotal,
        );
        couponCode = c.code;
        await db
          .from("coupons")
          .update({ used_count: Number(c.used_count) + 1 })
          .eq("id", c.id);
      }
    }

    const total = Math.max(0, subtotal - discount) + shipping;
    const orderNo = "AF" + Date.now().toString().slice(-8);

    const { data: order, error } = await db
      .from("orders")
      .insert({
        order_no: orderNo,
        customer_name: data.name,
        phone: data.phone,
        address: data.address,
        note: data.note || null,
        area: data.area,
        subtotal,
        shipping,
        discount,
        total,
        coupon_code: couponCode,
        status: "pending",
      })
      .select("id, order_no")
      .single();
    if (error) throw new Error(error.message);

    await db.from("order_items").insert(items.map((i) => ({ ...i, order_id: order.id })));
    await db
      .from("order_status_history")
      .insert({ order_id: order.id, status: "pending", note: "Order placed" });

    for (const i of items) {
      const p = list.find((x) => x.id === i.product_id)!;
      await db
        .from("products")
        .update({ stock: Math.max(0, Number(p.stock) - i.quantity) })
        .eq("id", p.id);
    }

    return {
      id: order.id as string,
      orderNo: order.order_no as string,
      total,
      subtotal,
      shipping,
      discount,
    };
  });

export const getOrderReceipt = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: order } = await db
      .from("orders")
      .select(
        "id, order_no, customer_name, phone, address, area, subtotal, shipping, discount, total, status, created_at, order_items(*)",
      )
      .eq("id", data.id)
      .maybeSingle();
    return order ?? null;
  });
