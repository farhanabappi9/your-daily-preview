import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "../lib/cart";
import { ProductsProvider } from "../lib/products-store";
import { I18nProvider } from "../lib/i18n";
import { ThemeCustomizer } from "../components/ThemeCustomizer";
import { useProducts } from "../lib/products-store";
import { useCart } from "../lib/cart";
import {
  initMetaPixel,
  resolveMetaPixelId,
  trackInitiateCheckout,
  trackPageView,
  trackViewContent,
} from "../lib/pixel";
import { gtmBeginCheckout, gtmPageView, gtmViewItem, initGtm } from "../lib/gtm";
import { captureAttribution } from "../lib/attribution";
import {
  initTikTokPixel,
  ttInitiateCheckout,
  ttPageView,
  ttViewContent,
} from "../lib/tiktok-pixel";
import { getStorefront } from "../lib/shop.functions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ahsan Fashion — Premium Fashion Store" },
      {
        name: "description",
        content: "Shop premium three piece, saree, couple sets and more at Ahsan Fashion.",
      },
      { name: "author", content: "Ahsan Fashion" },
      { property: "og:title", content: "Ahsan Fashion — Premium Fashion Store" },
      {
        property: "og:description",
        content: "Shop premium three piece, saree, couple sets and more at Ahsan Fashion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.jpg", type: "image/jpeg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@300;400;500;600;700&family=Playfair+Display:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * URL থেকে বোঝা যায় এমন event:
 *   - PageView / page_view — প্রতিটি SPA navigation-এ (প্রথমটা base code নিজেই পাঠায়)
 *   - ViewContent / view_item — প্রোডাক্ট পেজে
 *   - InitiateCheckout / begin_checkout — চেকআউট পেজ খুললে
 *
 * আগের দুইটা বাগ ঠিক করা হয়েছে:
 *   1. InitiateCheckout-এ `i.slug` পাঠানো হতো, কিন্তু cart item-এ slug থাকে
 *      `i.product.slug`-এ — ফলে content_ids সবসময় খালি যেত।
 *   2. সরাসরি /checkout বা /product/... লিংকে ঢুকলে (বিজ্ঞাপন থেকে যেমন হয়)
 *      কার্ট/প্রোডাক্ট তখনো লোড হয়নি, তাই event কখনো fire-ই হতো না। এখন ডেটা
 *      আসা পর্যন্ত অপেক্ষা করে, প্রতি পেজ-ভিজিটে একবারই পাঠায়।
 */
function PixelRouteTracker() {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const firstRender = useRef(true);
  const sentFor = useRef<{ view?: string; checkout?: string }>({});
  const { getBySlug } = useProducts();
  const { items, subtotal } = useCart();

  // PageView — শুধু pathname বদলালে
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackPageView();
    ttPageView();
    gtmPageView(pathname);
    sentFor.current = {};
  }, [pathname]);

  // ViewContent — প্রোডাক্ট ডেটা লোড হলে, প্রতি পেজে একবার
  const productMatch = pathname.match(/^\/product\/(.+)$/);
  const product = productMatch ? getBySlug(decodeURIComponent(productMatch[1])) : undefined;
  useEffect(() => {
    if (!product || sentFor.current.view === pathname) return;
    sentFor.current.view = pathname;
    const p = { slug: product.slug, name: product.name, price: product.price };
    trackViewContent(p);
    ttViewContent(p);
    gtmViewItem(p);
  }, [product, pathname]);

  // InitiateCheckout — কার্ট hydrate হওয়ার পরে, প্রতি চেকআউট-ভিজিটে একবার
  const onCheckout = pathname === "/checkout";
  const hasItems = items.length > 0;
  useEffect(() => {
    if (!onCheckout || !hasItems || sentFor.current.checkout === pathname) return;
    sentFor.current.checkout = pathname;
    const list = items.map((i) => ({ slug: i.product.slug, quantity: i.quantity }));
    trackInitiateCheckout({ items: list, value: subtotal });
    ttInitiateCheckout({ items: list, value: subtotal });
    gtmBeginCheckout({
      value: subtotal,
      items: items.map((i) => ({
        item_id: i.product.slug,
        item_name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
      })),
    });
    // items/subtotal ইচ্ছা করে বাদ — কার্টে প্রতিবার পরিবর্তনে আবার fire হবে না
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCheckout, hasItems, pathname]);

  return null;
}

/**
 * Pixel / Tag loader — সব ID admin প্যানেল থেকে আসে (`settings` টেবিল):
 *   - Facebook Pixel  (Admin → Facebook Pixel)
 *   - TikTok Pixel    (Admin → TikTok Pixel)
 *   - Google Tag Manager (Admin → Google Tag Manager)
 * ID খালি বা বন্ধ থাকলে সেই প্ল্যাটফর্মের কোনো script-ই লোড হয় না।
 *
 * সাথে প্রথম পেজ লোডেই ভিজিটর কোথা থেকে এসেছে (utm / ttclid / fbclid / gclid /
 * referrer) সেভ করা হয় — অর্ডারের "Source" কলাম এখান থেকেই আসে।
 */
function TrackingLoader() {
  const { data } = useQuery({ queryKey: ["storefront"], queryFn: () => getStorefront() });
  const settings = data?.settings as
    | {
        tiktokPixelId?: string;
        tiktokPixelEnabled?: boolean;
        metaPixelId?: string;
        metaPixelEnabled?: boolean;
        gtmId?: string;
        gtmEnabled?: boolean;
        gtmServerUrl?: string;
      }
    | undefined;

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    if (!settings) return;
    const metaId = resolveMetaPixelId(settings);
    if (metaId) initMetaPixel(metaId);
    if (settings.tiktokPixelEnabled !== false) initTikTokPixel(settings.tiktokPixelId);
    if (settings.gtmEnabled !== false) initGtm(settings.gtmId, settings.gtmServerUrl);
  }, [settings]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ProductsProvider>
        <CartProvider>
          <I18nProvider>
            <Outlet />
            <ThemeCustomizer />
            <PixelRouteTracker />
            <TrackingLoader />
          </I18nProvider>
        </CartProvider>
      </ProductsProvider>
    </QueryClientProvider>
  );
}
