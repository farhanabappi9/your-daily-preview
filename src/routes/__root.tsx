import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  META_PIXEL_ID,
  trackInitiateCheckout,
  trackPageView,
  trackViewContent,
} from "../lib/pixel";

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

/**
 * Meta Pixel base code, injected server-side so it is in the HTML from the
 * first byte. It only bootstraps `fbq` and fires the first PageView — every
 * later PageView comes from PixelRouteTracker below, because SPA navigation
 * never reloads the document.
 */
const META_PIXEL_SNIPPET = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: META_PIXEL_SNIPPET }} />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Fires the events that can be derived purely from the URL:
 *   - PageView on every navigation
 *   - ViewContent on a product page
 *   - InitiateCheckout when the checkout screen opens
 *
 * The first PageView is skipped because the base snippet already sent it.
 * AddToCart lives in the cart provider, Purchase in the thank-you route —
 * both need data the URL alone does not carry.
 */
function PixelRouteTracker() {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const firstRender = useRef(true);
  const { getBySlug } = useProducts();
  const { items, subtotal } = useCart();

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
    } else {
      trackPageView();
    }

    const productMatch = pathname.match(/^\/product\/(.+)$/);
    if (productMatch) {
      const product = getBySlug(decodeURIComponent(productMatch[1]));
      if (product) {
        trackViewContent({ slug: product.slug, name: product.name, price: product.price });
      }
      return;
    }

    if (pathname === "/checkout" && items.length > 0) {
      trackInitiateCheckout({
        items: items.map((i) => ({ slug: i.slug, quantity: i.quantity })),
        value: subtotal,
      });
    }
    // `items`/`subtotal` are intentionally excluded: the checkout event should
    // fire once when the page opens, not again on every cart tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, getBySlug]);

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
          </I18nProvider>
        </CartProvider>
      </ProductsProvider>
    </QueryClientProvider>
  );
}
