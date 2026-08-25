/**
 * TikTok Pixel helper.
 *
 * ডিজাইন নোট:
 *  - Pixel ID কোডে hardcode করা নেই। Admin → TikTok Pixel পেজ থেকে সেভ হয়ে
 *    `settings` টেবিলের `shop` blob-এ থাকে, আর `__root.tsx`-এর
 *    TikTokPixelLoader সেটি দিয়ে base code লোড করে।
 *  - সেটিংস আসতে কয়েক মিলিসেকেন্ড লাগে, তাই init-এর আগে fire হওয়া event
 *    একটা ছোট queue-তে জমা থাকে এবং init শেষে flush হয় (AddToCart হারায় না)।
 *  - server-side রেন্ডারে সবকিছু no-op; প্রতিটি call try/catch করা, যাতে
 *    tracking কখনোই দোকান ভাঙতে না পারে (ad blocker/স্লো নেটওয়ার্ক)।
 *  - Meta (Facebook) Pixel-এর কোডের সাথে এর কোনো সম্পর্ক নেই — দুইটা সম্পূর্ণ
 *    আলাদাভাবে চলে।
 */

type TtqQueueItem = { event: string; params?: Record<string, unknown>; eventId?: string };

type Ttq = {
  (...args: unknown[]): void;
  page: () => void;
  track: (event: string, params?: Record<string, unknown>, opts?: Record<string, unknown>) => void;
  identify?: (params: Record<string, unknown>) => void;
};

/** base code লোড হয়েছে কি না (একবারের বেশি লোড করা যাবে না)। */
let initialised = false;
/** init হওয়ার আগে জমে থাকা event। */
let pendingEvents: TtqQueueItem[] = [];
/** যেই ID দিয়ে init হয়েছে — debug/status দেখানোর জন্য। */
let activePixelId = "";

function ttq(): Ttq | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { ttq?: Ttq }).ttq;
  return fn && typeof fn.track === "function" ? fn : null;
}

/** ID valid দেখতে — admin ফর্ম ও loader দুই জায়গাতেই ব্যবহার হয়। */
export function isValidTikTokPixelId(id?: string | null): boolean {
  return /^[A-Za-z0-9]{8,40}$/.test((id ?? "").trim());
}

export function isTikTokPixelReady(): boolean {
  return initialised;
}

export function activeTikTokPixelId(): string {
  return activePixelId;
}

/**
 * TikTok base code (official snippet, TypeScript-safe করে লেখা)।
 * ID না থাকলে বা আগেই init হয়ে থাকলে কিছুই করে না।
 */
export function initTikTokPixel(pixelId?: string | null): void {
  if (typeof window === "undefined") return;
  const id = (pixelId ?? "").trim();
  if (!id || initialised) return;
  if (!isValidTikTokPixelId(id)) return;

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (function (w: any, d: Document, t: string) {
      w.TiktokAnalyticsObject = t;
      const ttqObj: any = (w[t] = w[t] || []);
      ttqObj.methods = [
        "page",
        "track",
        "identify",
        "instances",
        "debug",
        "on",
        "off",
        "once",
        "ready",
        "alias",
        "group",
        "enableCookie",
        "disableCookie",
        "holdConsent",
        "revokeConsent",
        "grantConsent",
      ];
      ttqObj.setAndDefer = function (obj: any, method: string) {
        obj[method] = function () {
          obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (let i = 0; i < ttqObj.methods.length; i++) {
        ttqObj.setAndDefer(ttqObj, ttqObj.methods[i]);
      }
      ttqObj.instance = function (instanceId: string) {
        const inst = (ttqObj._i && ttqObj._i[instanceId]) || [];
        for (let n = 0; n < ttqObj.methods.length; n++) {
          ttqObj.setAndDefer(inst, ttqObj.methods[n]);
        }
        return inst;
      };
      ttqObj.load = function (sdkId: string, options?: any) {
        const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
        const opts = options || {};
        ttqObj._i = ttqObj._i || {};
        ttqObj._i[sdkId] = [];
        ttqObj._i[sdkId]._u = url;
        ttqObj._t = ttqObj._t || {};
        ttqObj._t[sdkId] = +new Date();
        ttqObj._o = ttqObj._o || {};
        ttqObj._o[sdkId] = opts;
        const script = d.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.src = url + "?sdkid=" + sdkId + "&lib=" + t;
        const first = d.getElementsByTagName("script")[0];
        first?.parentNode?.insertBefore(script, first);
      };
      ttqObj.load(id);
      ttqObj.page();
    })(window as any, document, "ttq");
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch {
    // base code বসানো না গেলে চুপচাপ বাদ — page চলতে থাকবে
    return;
  }

  initialised = true;
  activePixelId = id;

  const queued = pendingEvents;
  pendingEvents = [];
  queued.forEach((e) => send(e.event, e.params, e.eventId));
}

function send(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined") return;

  if (!initialised) {
    // ID এখনো আসেনি — পরে flush হবে। queue ছোট রাখা হয়েছে যাতে মেমোরি না বাড়ে।
    if (pendingEvents.length < 20) pendingEvents.push({ event, params, eventId });
    return;
  }

  const q = ttq();
  if (!q) return;
  try {
    if (eventId) q.track(event, params ?? {}, { event_id: eventId });
    else q.track(event, params ?? {});
  } catch {
    /* tracking must never break the page */
  }
}

/** প্রতি route change-এ PageView (SPA navigation document reload করে না)। */
export function ttPageView(): void {
  if (!initialised) return; // base code নিজেই প্রথম page() পাঠিয়েছে
  const q = ttq();
  try {
    q?.page();
  } catch {
    /* noop */
  }
}

/** প্রোডাক্ট ডিটেইল পেজ — retargeting audience তৈরি হয়। */
export function ttViewContent(p: { slug: string; name: string; price: number }): void {
  send("ViewContent", {
    contents: [
      {
        content_id: p.slug,
        content_name: p.name,
        content_type: "product",
        quantity: 1,
        price: p.price,
      },
    ],
    content_type: "product",
    value: p.price,
    currency: "BDT",
  });
}

/** কার্টে যোগ — cart provider থেকে, তাই প্রতিটি path একবারই count হয়। */
export function ttAddToCart(p: {
  slug: string;
  name: string;
  price: number;
  quantity: number;
}): void {
  send("AddToCart", {
    contents: [
      {
        content_id: p.slug,
        content_name: p.name,
        content_type: "product",
        quantity: p.quantity,
        price: p.price,
      },
    ],
    content_type: "product",
    value: p.price * p.quantity,
    currency: "BDT",
  });
}

/** চেকআউট পেজ খোলা — purchase-এর আগের সবচেয়ে শক্ত signal। */
export function ttInitiateCheckout(cart: {
  items: { slug: string; quantity: number }[];
  value: number;
}): void {
  send("InitiateCheckout", {
    contents: cart.items.map((i) => ({
      content_id: i.slug,
      content_type: "product",
      quantity: i.quantity,
    })),
    content_type: "product",
    value: cart.value,
    currency: "BDT",
  });
}

/**
 * অর্ডার সম্পন্ন। TikTok-এ Purchase-এর সমতুল্য event হলো CompletePayment —
 * এটাই TikTok-এর algorithm optimise করে।
 *
 * orderNo `event_id` হিসেবে যায়, তাই thank-you পেজ refresh করলে TikTok সেটাকে
 * ডুপ্লিকেট হিসেবে বাদ দেয়, নতুন sale ধরে না।
 */
export function ttCompletePayment(order: {
  orderNo: string;
  value: number;
  items: { name: string; quantity: number }[];
}): void {
  send(
    "CompletePayment",
    {
      contents: order.items.map((i) => ({
        content_id: i.name,
        content_name: i.name,
        content_type: "product",
        quantity: i.quantity,
      })),
      content_type: "product",
      value: order.value,
      currency: "BDT",
    },
    `purchase-${order.orderNo}`,
  );
}
