import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DbCategory } from "./shop-types";

/**
 * অ্যাডমিনের জন্য ক্যাটাগরি ফাংশন।
 *
 * কেন নতুন ফাইল?
 *  - আগের অ্যাডমিন পেজ `getStorefront()` থেকে ক্যাটাগরি আনত, যা শুধু active=true গুলো দেখায়।
 *    তাই Inactive করলে ক্যাটাগরি অ্যাডমিন থেকেও হারিয়ে যেত।
 *  - এখানে লগইন করা অ্যাডমিনের টোকেন দিয়ে সব ক্যাটাগরি (active + inactive) আনা হয়।
 *  - সেভ/ডিলিট সত্যিই হয়েছে কিনা নিশ্চিত করা হয় (RLS বাধা দিলে আগে চুপচাপ ব্যর্থ হতো)।
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const categoryInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug দিন")
    .max(200)
    .regex(SLUG_RE, "Slug শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন (-) হতে পারবে। যেমন: kids-wear"),
  name: z.string().trim().min(1, "নাম দিন").max(200),
  name_en: z.string().trim().max(200).optional().default(""),
  image: z.string().max(1000).nullable().optional(),
  description: z.string().max(4000).optional().default(""),
  description_en: z.string().max(4000).optional().default(""),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
});

function friendly(err: { code?: string; message: string }): string {
  if (err.code === "23505") return "এই slug দিয়ে আগে থেকেই একটি ক্যাটাগরি আছে। অন্য slug দিন।";
  if (/row-level security|permission denied/i.test(err.message))
    return "এই কাজের জন্য আপনার অ্যাডমিন পারমিশন নেই। আবার লগইন করুন।";
  return err.message;
}

export const listAdminCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;

    const { data, error } = await db
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(friendly(error));

    // প্রতিটি ক্যাটাগরিতে কয়টি প্রোডাক্ট আছে (ডিলিটের আগে সতর্ক করার জন্য)
    const counts: Record<string, number> = {};
    const { data: prods } = await db.from("products").select("category_slug").limit(5000);
    for (const p of (prods ?? []) as { category_slug: string | null }[]) {
      if (p.category_slug) counts[p.category_slug] = (counts[p.category_slug] ?? 0) + 1;
    }

    return { categories: (data ?? []) as DbCategory[], counts };
  });

export const saveAdminCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof categoryInput>) => {
    const parsed = categoryInput.safeParse(d);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const row = {
      slug: data.slug,
      name: data.name,
      name_en: data.name_en || null,
      image: data.image || null,
      description: data.description || null,
      description_en: data.description_en || null,
      sort_order: data.sort_order,
      active: data.active,
    };

    if (data.id) {
      const { data: updated, error } = await db
        .from("categories")
        .update(row)
        .eq("id", data.id)
        .select("id");
      if (error) throw new Error(friendly(error));
      if (!updated?.length) throw new Error("ক্যাটাগরি আপডেট হয়নি (পারমিশন বা ID সমস্যা)।");
      return { id: data.id };
    }

    const { data: created, error } = await db.from("categories").insert(row).select("id").single();
    if (error) throw new Error(friendly(error));
    return { id: created.id as string };
  });

/** একটি বা একাধিক ক্যাটাগরি ডিলিট। প্রোডাক্টগুলো মুছে যায় না — শুধু "ক্যাটাগরিবিহীন" হয়ে যায়। */
export const deleteAdminCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await (context.supabase as any)
      .from("categories")
      .delete()
      .in("id", data.ids)
      .select("id");
    if (error) throw new Error(friendly(error));
    if (!deleted?.length) throw new Error("কোনো ক্যাটাগরি ডিলিট হয়নি (পারমিশন সমস্যা হতে পারে)।");
    return { ok: true, deleted: deleted.length as number };
  });
