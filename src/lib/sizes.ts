import type { Product } from "./products";

export type SizeGroup = {
  key: string;
  labelBn: string;
  labelEn: string;
  options: string[];
};

const MEN_LETTER = ["M", "L", "XL", "XXL"];
const MEN_PANJABI = ["38", "40", "42", "44", "46"];
const MEN_SHIRT = ["M", "L", "XL", "XXL"];
const WOMEN_LETTER = ["S", "M", "L", "XL", "XXL"];
const FREE_SIZE = ["Free Size"];

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

const menGroup = (options: string[]): SizeGroup => ({
  key: "men",
  labelBn: "ছেলেদের সাইজ",
  labelEn: "Men's size",
  options,
});

const womenGroup = (options: string[]): SizeGroup => ({
  key: "women",
  labelBn: "মেয়েদের সাইজ",
  labelEn: "Women's size",
  options,
});

const unisexGroup = (options: string[]): SizeGroup => ({
  key: "size",
  labelBn: "সাইজ",
  labelEn: "Size",
  options,
});

/**
 * Returns the size selectors a product needs.
 * Couple / combo products get two groups (men + women), everything else one.
 */
export function getSizeGroups(p: Pick<Product, "name" | "category" | "categorySlug">): SizeGroup[] {
  const text = `${p.name} ${p.category} ${p.categorySlug}`.toLowerCase();
  const cat = (p.categorySlug ?? "").toLowerCase();

  const isPanjabi = has(text, ["পাঞ্জাবি", "panjabi", "punjabi"]);
  const isSaree = has(text, ["শাড়ি", "শাড়ী", "saree", "sari"]);
  const isShirt = has(text, ["শার্ট", "shirt"]);
  const isCouple = cat.includes("couple") || has(text, ["কাপল", "couple", "কম্বো সেট"]);

  if (isCouple) {
    return [
      menGroup(isPanjabi ? MEN_PANJABI : MEN_SHIRT),
      womenGroup(isSaree ? FREE_SIZE : WOMEN_LETTER),
    ];
  }

  if (cat.includes("panjabi")) return [menGroup(MEN_PANJABI)];
  if (cat.includes("shirt")) return [menGroup(MEN_SHIRT)];
  if (cat.includes("saree")) return [womenGroup(FREE_SIZE)];
  if (cat.includes("ladies") || cat.includes("women")) return [womenGroup(WOMEN_LETTER)];

  // fallback by product name
  if (isSaree) return [womenGroup(FREE_SIZE)];
  if (isPanjabi) return [menGroup(MEN_PANJABI)];
  if (isShirt) return [menGroup(MEN_SHIRT)];
  if (
    has(text, [
      "থ্রি পিস",
      "টু পিস",
      "কুর্তি",
      "সালোয়ার",
      "কামিজ",
      "গাউন",
      "টপস",
      "স্কার্ট",
      "kurti",
      "three piece",
      "two piece",
      "gown",
      "tops",
      "skirt",
    ])
  )
    return [womenGroup(WOMEN_LETTER)];

  return [unisexGroup(MEN_LETTER)];
}

export function defaultSizes(groups: SizeGroup[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of groups)
    out[g.key] = g.options.includes("L") ? "L" : g.options[Math.floor(g.options.length / 2)];
  return out;
}

export function sizeLabel(key: string, lang: "bn" | "en"): string {
  if (key === "men") return lang === "bn" ? "ছেলেদের" : "Men";
  if (key === "women") return lang === "bn" ? "মেয়েদের" : "Women";
  return lang === "bn" ? "সাইজ" : "Size";
}

export function formatSizes(sizes: Record<string, string> | undefined, lang: "bn" | "en"): string {
  if (!sizes) return "";
  return Object.entries(sizes)
    .map(([k, v]) => `${sizeLabel(k, lang)}: ${v}`)
    .join(" • ");
}

export function sizeSignature(sizes: Record<string, string> | undefined): string {
  if (!sizes) return "";
  return Object.keys(sizes)
    .sort()
    .map((k) => `${k}:${sizes[k]}`)
    .join(",");
}

/* ---------- admin-configurable sizes ---------- */

import type { SizeConfig, SizeGroupConfig } from "./shop-types";

const normalizeGroup = (g: SizeGroupConfig): SizeGroup => ({
  key: g.key,
  labelBn:
    g.labelBn || (g.key === "men" ? "ছেলেদের সাইজ" : g.key === "women" ? "মেয়েদের সাইজ" : "সাইজ"),
  labelEn:
    g.labelEn || (g.key === "men" ? "Men's size" : g.key === "women" ? "Women's size" : "Size"),
  options: (g.options ?? []).filter(Boolean),
});

const groupDefaults = new WeakMap<SizeGroup, string>();

/**
 * Admin override (per product id, else per category) wins over auto-detection.
 */
export function resolveSizeGroups(
  p: Pick<Product, "id" | "name" | "category" | "categorySlug">,
  config?: SizeConfig,
): SizeGroup[] {
  const raw = config?.[p.id] ?? config?.[`cat:${p.categorySlug}`];
  if (raw && raw.length) {
    const groups = raw
      .filter((g) => (g.options ?? []).filter(Boolean).length)
      .map((g) => {
        const ng = normalizeGroup(g);
        if (g.default && ng.options.includes(g.default)) groupDefaults.set(ng, g.default);
        return ng;
      });
    if (groups.length) return groups;
  }
  return getSizeGroups(p);
}

/** Default selection, honouring an admin-set default option. */
export function defaultSizesFor(groups: SizeGroup[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of groups) {
    out[g.key] =
      groupDefaults.get(g) ??
      (g.options.includes("L") ? "L" : g.options[Math.floor(g.options.length / 2)]);
  }
  return out;
}

export const DEFAULT_SIZE_PRESETS: SizeGroupConfig[] = [
  {
    key: "men",
    labelBn: "ছেলেদের সাইজ",
    labelEn: "Men's size",
    options: ["M", "L", "XL", "XXL"],
    default: "L",
  },
  {
    key: "women",
    labelBn: "মেয়েদের সাইজ",
    labelEn: "Women's size",
    options: ["S", "M", "L", "XL", "XXL"],
    default: "L",
  },
  { key: "size", labelBn: "সাইজ", labelEn: "Size", options: ["Free Size"], default: "Free Size" },
];
