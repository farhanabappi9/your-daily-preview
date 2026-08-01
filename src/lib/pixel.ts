/**
 * Meta (Facebook) Pixel helper.
 *
 * Everything here is a no-op on the server and a no-op if the pixel script
 * has not loaded yet (ad blockers, slow networks, first paint). Tracking must
 * never be able to break the shop, so every call is wrapped defensively.
 */

export const META_PIXEL_ID = "1333331668960638";

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[] };

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fn === "function" ? fn : null;
}

function send(event: string, payload?: Record<string, unknown>, eventId?: string) {
  const f = fbq();
  if (!f) return;
  try {
    if (eventId) f("track", event, payload ?? {}, { eventID: eventId });
    else f("track", event, payload ?? {});
  } catch {
    /* tracking must never break the page */
  }
}

/** Fired on every route change — SPA navigation does not reload the document. */
export function trackPageView() {
  send("PageView");
}

/** Product detail page. Builds the retargeting audience. */
export function trackViewContent(p: { slug: string; name: string; price: number }) {
  send("ViewContent", {
    content_ids: [p.slug],
    content_name: p.name,
    content_type: "product",
    value: p.price,
    currency: "BDT",
  });
}

/** Someone put an item in the cart. */
export function trackAddToCart(p: { slug: string; name: string; price: number; quantity: number }) {
  send("AddToCart", {
    content_ids: [p.slug],
    content_name: p.name,
    content_type: "product",
    contents: [{ id: p.slug, quantity: p.quantity }],
    value: p.price * p.quantity,
    currency: "BDT",
  });
}

/** Reached the checkout page — the strongest pre-purchase signal. */
export function trackInitiateCheckout(cart: {
  items: { slug: string; quantity: number }[];
  value: number;
}) {
  send("InitiateCheckout", {
    content_ids: cart.items.map((i) => i.slug),
    contents: cart.items.map((i) => ({ id: i.slug, quantity: i.quantity })),
    content_type: "product",
    num_items: cart.items.reduce((sum, i) => sum + i.quantity, 0),
    value: cart.value,
    currency: "BDT",
  });
}

/**
 * Order placed. This is the event Meta's algorithm actually optimises against —
 * without an accurate value here, ROAS reporting and purchase optimisation are
 * both meaningless.
 *
 * `orderNo` is passed as the event ID so a page refresh on the thank-you screen
 * is deduplicated by Meta instead of being counted as a second sale.
 */
export function trackPurchase(order: {
  orderNo: string;
  value: number;
  items: { name: string; quantity: number }[];
}) {
  send(
    "Purchase",
    {
      value: order.value,
      currency: "BDT",
      content_type: "product",
      contents: order.items.map((i) => ({ id: i.name, quantity: i.quantity })),
      num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
    },
    `purchase-${order.orderNo}`,
  );
}
