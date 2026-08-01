import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminIdentity = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  setupMissing: boolean;
};

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminIdentity> => {
    const sb = context.supabase as any;
    const email = (context.claims as any)?.email ?? null;

    // Self-healing: the permanent owner gets its role back on every login.
    const { error: ensureError } = await sb.rpc("ensure_primary_admin");
    const { isSetupMissing } = await import("@/lib/admin-authorization.server");
    const setupMissing = Boolean(ensureError && isSetupMissing(ensureError.message));
    if (ensureError && !setupMissing) {
      console.error("[admin-auth] ensure_primary_admin failed:", ensureError.message);
    }

    const { data: isAdmin, error } = await sb.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) console.error("[admin-auth] has_role failed:", error.message);

    let isSuperAdmin = false;
    if (!setupMissing) {
      const { data: superFlag } = await sb.rpc("is_super_admin", { _user_id: context.userId });
      isSuperAdmin = Boolean(superFlag);
    }

    return {
      userId: context.userId,
      email,
      isAdmin: Boolean(isAdmin),
      isSuperAdmin,
      setupMissing,
    };
  });

/** Public: owner-account diagnostics for the login screen (owner email only). */
export const getAccountStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const { publicServerClient, isSetupMissing } = await import(
      "@/lib/admin-authorization.server"
    );
    const { PRIMARY_ADMIN_EMAIL } = await import("@/lib/super-admin-sql");
    const isPrimary = data.email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
    const base = {
      email: data.email.trim().toLowerCase(),
      isPrimaryAdmin: isPrimary,
      exists: false,
      emailConfirmed: false,
      isAdmin: false,
      setupMissing: false,
    };
    if (!isPrimary) return base;

    const { data: status, error } = await (publicServerClient() as any).rpc(
      "primary_admin_status",
    );
    if (error) {
      console.error("[admin-auth] primary_admin_status failed:", error.message);
      return { ...base, setupMissing: isSetupMissing(error.message) };
    }
    return { ...base, ...(status as object) };
  });

/** Public recovery: confirms + re-grants admin for the hard-coded owner email. */
export const repairPrimaryAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { publicServerClient, isSetupMissing, SETUP_MISSING_HINT } = await import(
    "@/lib/admin-authorization.server"
  );
  const { data, error } = await (publicServerClient() as any).rpc("ensure_primary_admin");
  if (error) {
    console.error("[admin-auth] repair failed:", error.message);
    return {
      ok: false as const,
      error: isSetupMissing(error.message) ? SETUP_MISSING_HINT : error.message,
    };
  }
  console.log("[admin-auth] primary admin repaired", JSON.stringify(data));
  return { ok: true as const, result: data };
});

/** Logs a failed email-link verification server-side and returns a readable report. */
export const reportAuthLinkFailure = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      url: string;
      error?: string;
      errorCode?: string;
      errorDescription?: string;
      hadCode: boolean;
      hadTokenHash: boolean;
    }) =>
      z
        .object({
          url: z.string().max(2000),
          error: z.string().max(300).optional(),
          errorCode: z.string().max(300).optional(),
          errorDescription: z.string().max(1000).optional(),
          hadCode: z.boolean(),
          hadTokenHash: z.boolean(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { describeAuthFailure } = await import("@/lib/admin-authorization.server");
    const diagnosis = describeAuthFailure(data);
    console.error(
      "[auth-callback] email link verification failed",
      JSON.stringify({
        reason: diagnosis.reason,
        error: data.error ?? null,
        errorCode: data.errorCode ?? null,
        errorDescription: data.errorDescription ?? null,
        hadCode: data.hadCode,
        hadTokenHash: data.hadTokenHash,
        url: data.url,
        at: new Date().toISOString(),
      }),
    );
    return diagnosis;
  });

export type ManagedUser = {
  userId: string;
  email: string | null;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  roles: string[];
  isSuperAdmin: boolean;
  isPermanent: boolean;
};

export const listUsersAndRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { isSetupMissing, SETUP_MISSING_HINT } = await import(
      "@/lib/admin-authorization.server"
    );
    const { data: superFlag } = await sb.rpc("is_super_admin", { _user_id: context.userId });
    const { data, error } = await sb.rpc("admin_list_users");
    if (error) {
      if (isSetupMissing(error.message)) throw new Error(SETUP_MISSING_HINT);
      throw new Error(error.message);
    }
    const users: ManagedUser[] = (data ?? []).map((u: any) => ({
      userId: u.user_id,
      email: u.email ?? null,
      emailConfirmed: Boolean(u.email_confirmed),
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      roles: u.roles ?? [],
      isSuperAdmin: Boolean(u.is_super),
      isPermanent: Boolean(u.is_permanent),
    }));
    return { me: { userId: context.userId, isSuperAdmin: Boolean(superFlag) }, users };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; assignment: "super_admin" | "admin" | "staff" | "none" }) =>
    z
      .object({
        email: z.string().email(),
        assignment: z.enum(["super_admin", "admin", "staff", "none"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: result, error } = await sb.rpc("admin_set_user_role", {
      _email: data.email,
      _assignment: data.assignment,
    });
    if (error) throw new Error(error.message);
    return result as { email: string; assignment: string };
  });



export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data: orders } = await db
      .from("orders")
      .select("id, order_no, customer_name, phone, total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: products } = await db.from("products").select("id, name, stock, active, price");
    const { data: items } = await db
      .from("order_items")
      .select("name, quantity, price")
      .limit(2000);
    return {
      orders: orders ?? [],
      products: products ?? [],
      items: items ?? [],
    };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: order, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: history } = await db
      .from("order_status_history")
      .select("*")
      .eq("order_id", data.id)
      .order("created_at", { ascending: true });
    return { order, history: history ?? [] };
  });

export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      status?: string;
      payment_status?: string;
      tracking_note?: string;
      admin_note?: string;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          status: z
            .enum([
              "pending",
              "confirmed",
              "processing",
              "shipped",
              "delivered",
              "cancelled",
              "returned",
            ])
            .optional(),
          payment_status: z.enum(["unpaid", "paid", "refunded"]).optional(),
          tracking_note: z.string().max(500).optional(),
          admin_note: z.string().max(1000).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { id, ...patch } = data;
    const { error } = await db.from("orders").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    if (patch.status) {
      await db.from("order_status_history").insert({ order_id: id, status: patch.status });
    }
    return { ok: true };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const productInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(300),
  name_en: z.string().trim().max(300).optional().default(""),
  price: z.number().min(0),
  old_price: z.number().min(0),
  stock: z.number().int().min(0),
  category_slug: z.string().max(200).nullable(),
  images: z.array(z.string().max(1000)).max(10),
  description: z.string().max(20000),
  badge: z.string().max(50).nullable().optional(),
  active: z.boolean(),
  featured: z.boolean(),
  sort_order: z.number().int().default(0),
});

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof productInput>) => productInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const row = { ...data, name_en: data.name_en || null, badge: data.badge || null };
    if (data.id) {
      const { error } = await db.from("products").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    delete (row as any).id;
    const { data: created, error } = await db.from("products").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const categoryInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  name_en: z.string().trim().max(200).optional().default(""),
  image: z.string().max(1000).nullable(),
  description: z.string().max(4000).optional().default(""),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof categoryInput>) => categoryInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const row = { ...data, name_en: data.name_en || null };
    if (data.id) {
      const { error } = await db.from("categories").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    delete (row as any).id;
    const { data: created, error } = await db.from("categories").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

const couponInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(40),
  type: z.enum(["percent", "flat"]),
  value: z.number().min(0),
  min_order: z.number().min(0),
  expires_at: z.string().nullable(),
  active: z.boolean(),
});

export const saveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof couponInput>) => couponInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const row = { ...data, code: data.code.toUpperCase(), expires_at: data.expires_at || null };
    if (data.id) {
      const { error } = await db.from("coupons").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    delete (row as any).id;
    const { data: created, error } = await db.from("coupons").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("coupons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true });
    return data ?? [];
  });

const bannerInput = z.object({
  id: z.string().uuid().optional(),
  image: z.string().min(1).max(1000),
  title: z.string().max(200).nullable(),
  subtitle: z.string().max(300).nullable(),
  link: z.string().max(500).nullable(),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const saveBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof bannerInput>) => bannerInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const row = { ...data };
    if (data.id) {
      const { error } = await db.from("banners").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    delete (row as any).id;
    const { data: created, error } = await db.from("banners").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { value: Record<string, unknown> }) =>
    z.object({ value: z.record(z.string(), z.any()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("settings")
      .upsert({ key: "shop", value: data.value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
