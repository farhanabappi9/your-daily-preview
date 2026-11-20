import { resolveAssetUrl } from "@/lib/asset-map";
import { CATEGORY_IMAGES } from "@/lib/category-images";
import type { DbCategory } from "@/lib/shop-types";

/**
 * ডাটাবেসের (Supabase) category row → ওয়েবসাইটে দেখানোর জন্য প্রস্তুত অবজেক্ট।
 * Header, হোম, শপ ও ক্যাটাগরি পেজ — সবাই এখন এই একই সোর্স (ডাটাবেস) ব্যবহার করবে।
 */
export type CategoryView = {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  image: string;
  srcSet: string;
};

// ছবি না থাকলে এই সাদামাটা প্লেসহোল্ডার দেখাবে (যাতে ছবির জায়গা ফাঁকা/ভাঙা না দেখায়)
const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#6b7280"/><stop offset="1" stop-color="#1f2937"/>` +
      `</linearGradient></defs><rect width="480" height="640" fill="url(#g)"/></svg>`,
  );

function pickImage(c: DbCategory): { src: string; srcSet: string } {
  const raw = c.image ?? "";
  const isLegacy = raw.includes("/__l5e/assets-v1/");

  // ১. অ্যাডমিন প্যানেল থেকে নতুন আপলোড/লিংক দেওয়া ছবি — সবার আগে এটা
  if (raw && !isLegacy) return { src: raw, srcSet: "" };

  // ২. আগে থেকে প্রজেক্টে থাকা ৭টি ক্যাটাগরির বান্ডেল করা ছবি
  const bundled = CATEGORY_IMAGES[c.slug];
  if (bundled) return bundled;

  // ৩. পুরনো asset URL থাকলে সেটা রিজলভ করা
  const resolved = resolveAssetUrl(raw);
  if (resolved) return { src: resolved, srcSet: "" };

  // ৪. কিছুই না থাকলে প্লেসহোল্ডার
  return { src: PLACEHOLDER_SVG, srcSet: "" };
}

export function toCategoryView(c: DbCategory): CategoryView {
  const img = pickImage(c);
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    nameEn: c.name_en || c.name,
    description: c.description ?? "",
    descriptionEn: c.description_en || c.description || "",
    image: img.src,
    srcSet: img.srcSet,
  };
}
