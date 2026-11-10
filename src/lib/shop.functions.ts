import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DbBanner, DbCategory, DbProduct, ShopSettings } from "./shop-types";
import { DEFAULT_SETTINGS } from "./shop-types";
import { publicClient, serviceKeyProblem } from "./shop.server";
import { detectOrderSource, normalizeBdPhone } from "./order-source";

export const getStorefront = createServerFn({ method: "GET" }).handler(async () => {
  let db: ReturnType<typeof publicClient>;
  try {
    db = publicClient();
  } catch (e: any) {
    // Config problem — log loudly so it shows up in `wrangler tail` / host logs
    // instead of silently rendering an empty shop.
    console.error("[storefront] Supabase client could not be created:", e?.message ?? e);
    return {
      products: [] as DbProduct[],
      categories: [] as DbCategory[],
      banners: [] as DbBanner[],
      settings: DEFAULT_SETTINGS,
      error: String(e?.message ?? e),
    };
  }

  const [products, categories, banners, settings] = await Promise.all([
    db.from("products").select("*").eq("active", true).order("sort_order", { ascending: true }),
    db.from("categories").select("*").eq("active", true).order("sort_order", { ascending: true }),
    db.from("banners").select("*").eq("active", true).order("sort_order", { ascending: true }),
    db.from("settings").select("value").eq("key", "shop").maybeSingle(),
  ]);

  // Previously every one of these errors was swallowed by `?? []`, which turned
  // an RLS/permission/connection failure into a silently empty storefront.
  const failures = [
    products.error && `products: ${products.error.message}`,
    categories.error && `categories: ${categories.error.message}`,
    banners.error && `banners: ${banners.error.message}`,
    settings.error && `settings: ${settings.error.message}`,
  ].filter(Boolean) as string[];

  if (failures.length) console.error("[storefront] Supabase query failed —", failures.join(" | "));

  return {
    products: (products.data ?? []) as DbProduct[],
    categories: (categories.data ?? []) as DbCategory[],
    banners: (banners.data ?? []) as DbBanner[],
    settings: {
      ...DEFAULT_SETTINGS,
      ...((settings.data?.value ?? {}) as Partial<ShopSettings>),
    } as ShopSettings,
    error: failures.length ? failures.join(" | ") : null,
  };
});

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const db = publicClient();
    const { data: row, error } = await db
      .from("products")
      .select("*")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) console.error("[storefront] getProductBySlug failed:", error.message);
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

/** Maximum lengths — keep these in sync with the `maxLength` props in checkout.tsx. */
export const ORDER_LIMITS = { name: 100, phone: 20, address: 500, note: 500, coupon: 40 } as const;

const s200 = z.string().trim().max(200).optional();
const s500 = z.string().trim().max(500).optional();
const touchSchema = z
  .object({
    utm_source: s200,
    utm_medium: s200,
    utm_campaign: s200,
    utm_content: s200,
    utm_term: s200,
    ttclid: s500,
    fbclid: s500,
    gclid: s500,
    gbraid: s500,
    wbraid: s500,
    referrer: s500,
    landing_page: s500,
    ts: z.string().max(40).optional(),
  })
  .partial();

/**
 * কোথা থেকে এসেছে (utm / click id / referrer / pixel cookie)। ভুল বা বড় ডেটা
 * এলে `.catch(undefined)` — অর্থাৎ tracking ডেটার কারণে কখনো অর্ডার আটকাবে না।
 */
const attributionSchema = touchSchema
  .extend({
    first_source_touch: touchSchema.optional(),
    fbp: s200,
    fbc: s500,
    ttp: s200,
    ga_client_id: z.string().trim().max(100).optional(),
    page_url: s500,
  })
  .optional()
  .catch(undefined);

const orderInput = z.object({
  name: z.string().trim().min(2).max(ORDER_LIMITS.name),
  phone: z.string().trim().min(6).max(ORDER_LIMITS.phone),
  address: z.string().trim().min(5).max(ORDER_LIMITS.address),
  note: z.string().trim().max(ORDER_LIMITS.note).optional().default(""),
  area: z.enum(["inside", "outside"]),
  couponCode: z.string().trim().max(ORDER_LIMITS.coupon).optional().default(""),
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
  /** চেকআউট পেজে একবার তৈরি হওয়া ID — একই ID দিয়ে দ্বিতীয় অর্ডার ঢোকে না। */
  checkoutToken: z.string().uuid().optional().catch(undefined),
  attribution: attributionSchema,
});

const FIELD_LABEL: Record<string, string> = {
  name: "নাম",
  phone: "মোবাইল নম্বর",
  address: "ঠিকানা",
  note: "নোট",
  area: "ডেলিভারি এলাকা",
  couponCode: "কুপন কোড",
  items: "কার্ট",
};

/**
 * Turns a Zod failure into a single sentence the customer can act on.
 *
 * Without this the raw issue array was serialised straight into the error
 * message and rendered under the confirm button — the shopper saw JSON like
 * `[{"code":"too_big","path":["name"]}]` and simply abandoned the order.
 */
function friendlyOrderError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "তথ্য সঠিকভাবে পূরণ করুন।";

  const field = String(issue.path[0] ?? "");
  const label = FIELD_LABEL[field] ?? field;

  if (field === "items") return "কার্টে কোনো পণ্য নেই। আবার চেষ্টা করুন।";

  switch (issue.code) {
    case "too_big":
      return `${label} সর্বোচ্চ ${(issue as { maximum?: number }).maximum} অক্ষরের হতে পারে। একটু ছোট করে লিখুন।`;
    case "too_small":
      return field === "phone"
        ? "সঠিক মোবাইল নম্বর দিন (কমপক্ষে ৬ ডিজিট)।"
        : `${label} আরও বিস্তারিত লিখুন (কমপক্ষে ${(issue as { minimum?: number }).minimum} অক্ষর)।`;
    case "invalid_type":
      return `${label} পূরণ করুন।`;
    default:
      return `${label} সঠিকভাবে পূরণ করুন।`;
  }
}

type PlacedOrder = {
  id: string;
  orderNo: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  /** true হলে নতুন অর্ডার তৈরি হয়নি — আগের একই অর্ডারটাই ফেরত দেওয়া হয়েছে */
  duplicate: boolean;
};

function toPlaced(row: any, duplicate: boolean): PlacedOrder {
  return {
    id: row.id as string,
    orderNo: row.order_no as string,
    total: Number(row.total),
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    discount: Number(row.discount),
    duplicate,
  };
}

const PLACED_COLUMNS = "id, order_no, total, subtotal, shipping, discount";

/** নতুন column গুলো এখনো DB-তে না থাকলে (SQL চালানো হয়নি) যে error আসে। */
function isMissingColumnError(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(err.message ?? "")
  );
}

/** একই পণ্য + একই পরিমাণ কি না — ডুপ্লিকেট চেকের জন্য। */
function itemsSignature(items: { product_id: string; quantity: number }[]): string {
  return items
    .map((i) => `${i.product_id}:${i.quantity}`)
    .sort()
    .join("|");
}

/** একই কাস্টমার এই সময়ের মধ্যে হুবহু একই অর্ডার দিলে নতুন অর্ডার না বানিয়ে আগেরটা ফেরত। */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof orderInput>) => {
    const parsed = orderInput.safeParse(d);
    if (!parsed.success) throw new Error(friendlyOrderError(parsed.error));
    const phone = normalizeBdPhone(parsed.data.phone);
    if (!phone) {
      throw new Error("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন 01712345678)।");
    }
    return { ...parsed.data, phone };
  })
  .handler(async ({ data }): Promise<PlacedOrder> => {
    // Fail fast (and loudly in the logs) if the "service role" key is really the
    // anon key — that is what makes the `orders` insert get rejected.
    const keyProblem = serviceKeyProblem();
    if (keyProblem) console.error("[order] CONFIG ERROR —", keyProblem);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // ---- ১. একই checkout token আগে এসেছে? (ডাবল ক্লিক / নেটওয়ার্ক রিট্রাই) ----
    if (data.checkoutToken) {
      const { data: existing, error: tokenError } = await db
        .from("orders")
        .select(PLACED_COLUMNS)
        .eq("checkout_token", data.checkoutToken)
        .maybeSingle();
      if (existing) return toPlaced(existing, true);
      if (tokenError && !isMissingColumnError(tokenError)) {
        console.error("[order] checkout token lookup failed:", tokenError.message);
      }
    }

    const slugs = data.items.map((i) => i.slug);
    const { data: products, error: lookupError } = await db
      .from("products")
      .select("*")
      .in("slug", slugs)
      .eq("active", true);
    if (lookupError) {
      console.error("[order] product lookup failed:", lookupError.message);
      throw new Error("পণ্য যাচাই করা যায়নি, একটু পরে আবার চেষ্টা করুন।");
    }
    const list = (products ?? []) as DbProduct[];
    if (!list.length) {
      throw new Error(
        "কার্টের পণ্যগুলো এখন আর পাওয়া যাচ্ছে না। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।",
      );
    }

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

    if (!items.length) {
      throw new Error(
        "কার্টের পণ্যগুলো এখন আর পাওয়া যাচ্ছে না। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।",
      );
    }

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
    if (!Number.isFinite(shipping) || shipping < 0) shipping = 0;
    if (settings.freeShippingOver > 0 && subtotal >= settings.freeShippingOver) shipping = 0;

    // Coupon is only *validated* here. used_count is incremented AFTER the order
    // is saved, so a failed order never burns a coupon use.
    let discount = 0;
    let couponCode: string | null = null;
    let couponRow: any = null;
    if (data.couponCode) {
      const { data: c } = await db
        .from("coupons")
        .select("*")
        .ilike("code", data.couponCode)
        .eq("active", true)
        .maybeSingle();
      const valid =
        c &&
        (!c.expires_at || new Date(c.expires_at) >= new Date()) &&
        subtotal >= Number(c.min_order);
      if (valid) {
        discount = Math.min(
          subtotal,
          c.type === "percent"
            ? Math.round((subtotal * Number(c.value)) / 100)
            : Math.round(Number(c.value)),
        );
        couponCode = c.code;
        couponRow = c;
      }
    }

    const total = Math.max(0, subtotal - discount) + shipping;

    // ---- ২. একই ফোন থেকে কয়েক মিনিটের মধ্যে হুবহু একই অর্ডার? ----
    {
      const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
      const { data: recent } = await db
        .from("orders")
        .select(`${PLACED_COLUMNS}, status, order_items(product_id, quantity)`)
        .eq("phone", data.phone)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);
      const sig = itemsSignature(items);
      const dup = (recent ?? []).find(
        (o: any) =>
          o.status !== "cancelled" &&
          Number(o.total) === total &&
          itemsSignature(o.order_items ?? []) === sig,
      );
      if (dup) {
        console.log("[order] duplicate submit ignored, returning", dup.order_no);
        return toPlaced(dup, true);
      }
    }

    // ---- ৩. সোর্স (TikTok / Facebook / Google …) ----
    const { getRequestHeader, getRequest } = await import("@tanstack/react-start/server");
    const userAgent = (getRequestHeader("user-agent") ?? "").slice(0, 400);
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-real-ip") ??
      (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ??
      "";
    const attr = data.attribution ?? {};
    const detected = detectOrderSource({ ...attr, user_agent: userAgent });
    const {
      fbp: _fbp,
      fbc: _fbc,
      ttp: _ttp,
      ga_client_id: _ga,
      ...attributionToStore
    } = attr as Record<string, unknown>;
    void _fbp;
    void _fbc;
    void _ttp;
    void _ga;

    // 8 digits of the clock + 3 random digits — avoids UNIQUE(order_no) clashes
    // when two customers order within the same millisecond.
    const orderNo =
      "AF" +
      Date.now().toString().slice(-8) +
      Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");

    const baseRow = {
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
      payment_method: "cod",
      payment_status: "unpaid",
    };
    const trackingRow = {
      source: detected.source,
      source_medium: detected.medium,
      attribution: { ...attributionToStore, detected_by: detected.reason },
      checkout_token: data.checkoutToken ?? null,
      user_agent: userAgent || null,
    };

    let insert = await db
      .from("orders")
      .insert({ ...baseRow, ...trackingRow })
      .select(PLACED_COLUMNS)
      .single();

    // নতুন SQL এখনো চালানো না হলেও অর্ডার যেন না আটকায়
    if (insert.error && isMissingColumnError(insert.error)) {
      console.error(
        "[order] source/checkout_token column নেই — supabase/migrations/20261110120000_order_source_tracking.sql চালান। সোর্স ছাড়াই অর্ডার সেভ করা হলো।",
      );
      insert = await db.from("orders").insert(baseRow).select(PLACED_COLUMNS).single();
    }

    // একই token দিয়ে একসাথে দুইটা request এসেছিল — অন্যটা আগে সেভ হয়ে গেছে
    if (insert.error?.code === "23505" && data.checkoutToken) {
      const { data: existing } = await db
        .from("orders")
        .select(PLACED_COLUMNS)
        .eq("checkout_token", data.checkoutToken)
        .maybeSingle();
      if (existing) return toPlaced(existing, true);
    }

    const { data: order, error } = insert;
    if (error || !order) {
      // Full detail goes to the server log (wrangler tail / Cloudflare Logs);
      // the customer only sees the friendly sentence.
      console.error(
        "[order] insert failed:",
        JSON.stringify({
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
        }),
        keyProblem ? `| LIKELY CAUSE: ${keyProblem}` : "",
      );
      throw new Error("অর্ডার সংরক্ষণ করা যায়নি। একটু পরে আবার চেষ্টা করুন অথবা আমাদের কল করুন।");
    }

    // Items are mandatory — if they fail, remove the empty order instead of
    // leaving a ghost order with no products.
    const { error: itemsError } = await db
      .from("order_items")
      .insert(items.map((i) => ({ ...i, order_id: order.id })));
    if (itemsError) {
      console.error("[order] order_items insert failed:", itemsError.message);
      await db.from("orders").delete().eq("id", order.id);
      throw new Error("অর্ডার সংরক্ষণ করা যায়নি। একটু পরে আবার চেষ্টা করুন অথবা আমাদের কল করুন।");
    }

    const { error: historyError } = await db
      .from("order_status_history")
      .insert({ order_id: order.id, status: "pending", note: "Order placed" });
    if (historyError) console.error("[order] status history insert failed:", historyError.message);

    if (couponRow) {
      const { error: couponError } = await db
        .from("coupons")
        .update({ used_count: Number(couponRow.used_count) + 1 })
        .eq("id", couponRow.id);
      if (couponError) console.error("[order] coupon count update failed:", couponError.message);
    }

    for (const i of items) {
      const p = list.find((x) => x.id === i.product_id)!;
      const { error: stockError } = await db
        .from("products")
        .update({ stock: Math.max(0, Number(p.stock) - i.quantity) })
        .eq("id", p.id);
      if (stockError) console.error("[order] stock update failed:", p.slug, stockError.message);
    }

    // ---- ৪. Server-side purchase event (Facebook CAPI / TikTok Events API / GA4) ----
    // key সেট না থাকলে কিছুই হয় না। কোনো error অর্ডারকে প্রভাবিত করে না।
    try {
      const { data: secretRow } = await db
        .from("private_settings")
        .select("value")
        .eq("key", "tracking")
        .maybeSingle();
      const secrets = (secretRow?.value ??
        {}) as import("./server-tracking.server").TrackingSecrets;
      if (secrets.metaCapiToken || secrets.tiktokAccessToken || secrets.ga4ApiSecret) {
        const { sendServerPurchaseEvents, findWaitUntil } =
          await import("./server-tracking.server");
        const job = sendServerPurchaseEvents(settings, secrets, {
          orderNo: order.order_no,
          value: total,
          shipping,
          phone: data.phone,
          name: data.name,
          items: items.map((i) => {
            const p = list.find((x) => x.id === i.product_id);
            return {
              id: p?.slug ?? i.product_id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            };
          }),
          ip: ip || undefined,
          userAgent: userAgent || undefined,
          pageUrl: (attr.page_url as string | undefined) ?? undefined,
          referrer: (attr.referrer as string | undefined) ?? undefined,
          fbp: attr.fbp,
          fbc: attr.fbc,
          ttp: attr.ttp,
          ttclid: attr.ttclid,
          gaClientId: attr.ga_client_id,
        }).then(async (result) => {
          await db
            .from("orders")
            .update({ server_events: { ...result, at: new Date().toISOString() } })
            .eq("id", order.id);
        });
        const waitUntil = findWaitUntil(getRequest());
        if (waitUntil) waitUntil(job.catch(() => {}));
        else await Promise.race([job.catch(() => {}), new Promise((r) => setTimeout(r, 3500))]);
      }
    } catch (e: any) {
      console.error("[order] server-side tracking skipped:", e?.message ?? e);
    }

    return toPlaced(order, false);
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
