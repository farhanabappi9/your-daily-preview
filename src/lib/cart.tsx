import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "./products";
import { trackAddToCart } from "./pixel";
import { ttAddToCart } from "./tiktok-pixel";
import { sizeSignature } from "./sizes";

export type CartItem = {
  key: string;
  product: Product;
  quantity: number;
  sizes?: Record<string, string>;
};

type CartCtx = {
  items: CartItem[];
  add: (p: Product, qty?: number, sizes?: Record<string, string>) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "nm_cart_v1";

const itemKey = (p: Product, sizes?: Record<string, string>) => `${p.id}|${sizeSignature(sizes)}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        setItems(
          (parsed ?? [])
            .filter((i) => i?.product)
            .map((i) => ({ ...i, key: i.key ?? itemKey(i.product, i.sizes) })),
        );
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add: CartCtx["add"] = (p, qty = 1, sizes) => {
    // Tracked here rather than in each button so every path into the cart —
    // product page, quick-add on a card, related products — is counted once.
    trackAddToCart({ slug: p.slug, name: p.name, price: p.price, quantity: qty });
    // TikTok Pixel — একই জায়গা থেকে, Meta-র পাশাপাশি (একটা ব্যর্থ হলেও অন্যটা চলবে)
    ttAddToCart({ slug: p.slug, name: p.name, price: p.price, quantity: qty });

    const key = itemKey(p, sizes);
    setItems((prev) => {
      const found = prev.find((i) => i.key === key);
      if (found) return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + qty } : i));
      return [...prev, { key, product: p, quantity: qty, sizes }];
    });
  };
  const remove: CartCtx["remove"] = (key) => setItems((prev) => prev.filter((i) => i.key !== key));
  const setQty: CartCtx["setQty"] = (key, qty) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, qty) } : i)));
  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.product.price, 0);

  return (
    <Ctx.Provider value={{ items, add, remove, setQty, clear, count, subtotal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
