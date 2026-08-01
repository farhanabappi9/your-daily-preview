import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { products as bundledProducts, type Product } from "./products";
import { getStorefront } from "./shop.functions";
import type { DbBanner, DbCategory, DbProduct, ShopSettings } from "./shop-types";
import { DEFAULT_SETTINGS } from "./shop-types";
import { resolveAssetUrl } from "./asset-map";

type Ctx = {
  products: Product[];
  dbProducts: DbProduct[];
  categories: DbCategory[];
  banners: DbBanner[];
  settings: ShopSettings;
  loading: boolean;
  getById: (id: string) => Product | undefined;
  getBySlug: (slug: string) => Product | undefined;
};

const C = createContext<Ctx | null>(null);

const bundledAssetByFilename = new Map(
  bundledProducts.flatMap((product) =>
    (product.images ?? [product.image]).map((image) => [image.split("/").pop(), image]),
  ),
);

function resolveProductImage(image: string) {
  if (!image.includes("/__l5e/assets-v1/")) return image;
  const resolved = resolveAssetUrl(image);
  if (resolved !== image) return resolved;
  return bundledAssetByFilename.get(image.split("/").pop()) ?? image;
}

export function toProduct(p: DbProduct, categoryName?: string): Product {
  const bundled = bundledProducts.find((product) => product.slug === p.slug);
  const images = (p.images ?? []).map(resolveProductImage);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: Number(p.price),
    oldPrice: Number(p.old_price),
    image: images[0] ?? bundled?.image ?? "",
    images,
    category: categoryName ?? p.category_slug ?? "",
    categorySlug: p.category_slug ?? "",
    description: p.description ?? "",
    stock: p.stock,
  };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["storefront"],
    queryFn: () => getStorefront(),
    staleTime: 30_000,
  });

  const value = useMemo<Ctx>(() => {
    const dbProducts = data?.products ?? [];
    const categories = data?.categories ?? [];
    const nameBySlug = new Map(categories.map((c) => [c.slug, c.name]));
    const products = dbProducts.map((p) => toProduct(p, nameBySlug.get(p.category_slug ?? "")));
    return {
      products,
      dbProducts,
      categories,
      banners: data?.banners ?? [],
      settings: data?.settings ?? DEFAULT_SETTINGS,
      loading: isLoading,
      getById: (id) => products.find((p) => p.id === id),
      getBySlug: (slug) => products.find((p) => p.slug === slug),
    };
  }, [data, isLoading]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useProducts() {
  const c = useContext(C);
  if (!c) throw new Error("useProducts must be used within ProductsProvider");
  return c;
}
