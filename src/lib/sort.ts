import type { Product } from "@/lib/products";

export type SortKey = "popular" | "price-asc" | "price-desc" | "newest" | "discount";

export const sortOptions: { key: SortKey; bn: string; en: string }[] = [
  { key: "popular", bn: "জনপ্রিয়তা", en: "Popularity" },
  { key: "newest", bn: "নতুন যোগ করা", en: "Newest" },
  { key: "price-asc", bn: "দাম: কম থেকে বেশি", en: "Price: low to high" },
  { key: "price-desc", bn: "দাম: বেশি থেকে কম", en: "Price: high to low" },
  { key: "discount", bn: "সর্বোচ্চ ছাড়", en: "Biggest discount" },
];

const discount = (p: Product) => (p.oldPrice > 0 ? (p.oldPrice - p.price) / p.oldPrice : 0);

/** popularity proxy: fewer items left = more sold */
const popularity = (p: Product) => -p.stock;

export function sortProducts(items: Product[], key: SortKey): Product[] {
  const list = [...items];
  switch (key) {
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
    case "newest":
      return list.sort((a, b) => Number(b.id) - Number(a.id));
    case "discount":
      return list.sort((a, b) => discount(b) - discount(a));
    case "popular":
    default:
      return list.sort((a, b) => popularity(b) - popularity(a));
  }
}
