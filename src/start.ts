import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
//
// আগের ডিফল্ট সেটিং খুব কড়া ছিল: TikTok / Facebook-এর in-app browser, পুরনো
// iPhone (iOS 16.3 বা আগের) আর কিছু Android WebView `Sec-Fetch-Site` header
// পাঠায় না বা `none` পাঠায়, আবার কখনো Origin "null" আসে — তখন "অর্ডার
// কনফার্ম" বাটনে চাপলেও server 403 Forbidden দিত, অর্ডার সেভই হতো না।
// এখন: অন্য কোনো ওয়েবসাইট থেকে আসা request (cross-site) আগের মতোই বন্ধ, কিন্তু
// নিজের ডোমেইন (www / non-www, http / https) আর header-ছাড়া in-app browser চলবে।
const hostOf = (value: string): string | null => {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  secFetchSite: (value, ctx) => {
    if (value === "same-origin" || value === "same-site" || value === "none") return true;
    // cross-site: শুধু তখনই চলবে যখন Origin আসলে নিজের ডোমেইনেরই (proxy/CDN-এর কারণে ভুল header)
    const origin = ctx.request.headers.get("Origin");
    const own = hostOf(ctx.request.url);
    return !!origin && !!own && hostOf(origin) === own;
  },
  origin: (value, ctx) => {
    if (value === "null") return true; // কিছু in-app WebView এভাবে পাঠায়
    const own = hostOf(ctx.request.url);
    return !!own && hostOf(value) === own;
  },
  allowRequestsWithoutOriginCheck: true,
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
