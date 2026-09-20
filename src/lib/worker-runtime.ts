/**
 * Access to the Cloudflare Worker `env` (bindings + secrets) and `ctx`
 * (waitUntil) from anywhere in the app.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The build output is a Nitro Cloudflare "module worker". Nitro's own entry
 * (`.output/server/index.mjs`) is the real Worker. It receives
 * `fetch(request, env, context)` from Cloudflare, stores the env on
 * `globalThis.__env__`, and then calls the app like this:
 *
 *     nitroApp.fetch(request)        // <-- one argument only
 *     ...
 *     services.ssr.fetch(req)        // <-- one argument only
 *
 * `services.ssr` is our `src/server.ts`. So the `env` and `ctx` parameters in
 *
 *     export default { async fetch(request, env, ctx) { ... } }
 *
 * are ALWAYS `undefined` in production. That single fact broke:
 *   - `env.PRODUCT_IMAGES` -> R2 was never read, so every image fell through
 *     to Supabase Storage (which is empty on the current Supabase project).
 *   - `env.PRODUCT_IMAGES` in the upload handler -> admin image upload always
 *     returned 500 "R2 bucket not configured".
 *   - `ctx.waitUntil` -> edge-cache writes and R2 backfills silently no-oped.
 *
 * Nitro *does* expose the env, just not as a function argument. We read it
 * from the places Nitro actually populates.
 */

export type R2Object = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  size?: number;
};

export type R2Bucket = {
  get: (key: string) => Promise<R2Object | null>;
  put: (
    key: string,
    value: ArrayBuffer | ReadableStream | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
  list: (options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }) => Promise<{ objects: Array<{ key: string; size: number }>; truncated?: boolean; cursor?: string }>;
  delete: (key: string) => Promise<void>;
};

export type WorkerEnv = {
  PRODUCT_IMAGES?: R2Bucket;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Comma-separated extra origins to pull images from, e.g. old Supabase projects. */
  LEGACY_IMAGE_ORIGINS?: string;
  /** Lovable preview origin, used to recover the original bundled catalog images. */
  LOVABLE_ORIGIN?: string;
  [key: string]: unknown;
};

/**
 * Resolve the Worker env.
 *
 * Order matters — the first source that actually has bindings wins:
 *  1. an env explicitly handed to us (real `fetch(request, env, ctx)` call)
 *  2. `globalThis.__env__`  — set by Nitro's cloudflare module handler on
 *     every single request, before the app runs
 *  3. `request.runtime.cloudflare.env` — Nitro also augments the Request
 *  4. `process.env` — local dev / node, no bindings but the string vars work
 */
export function getWorkerEnv(explicit?: unknown, request?: Request): WorkerEnv {
  const candidates: Array<unknown> = [
    explicit,
    (globalThis as { __env__?: unknown }).__env__,
    (request as unknown as { runtime?: { cloudflare?: { env?: unknown } } })?.runtime?.cloudflare?.env,
  ];

  const merged: WorkerEnv = {};
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      for (const [key, value] of Object.entries(candidate as Record<string, unknown>)) {
        if (merged[key] === undefined && value !== undefined) merged[key] = value;
      }
    }
  }

  // String-only fallbacks (no bindings live here, but secrets may).
  try {
    const penv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (penv) {
      for (const [key, value] of Object.entries(penv)) {
        if (merged[key] === undefined && value !== undefined) merged[key] = value;
      }
    }
  } catch {
    /* no process in this runtime */
  }

  return merged;
}

/** The R2 bucket binding, or undefined when it genuinely is not configured. */
export function getProductImagesBucket(explicit?: unknown, request?: Request): R2Bucket | undefined {
  const bucket = getWorkerEnv(explicit, request).PRODUCT_IMAGES;
  // A real binding has .get/.put. A leftover string var does not.
  if (bucket && typeof (bucket as R2Bucket).get === "function") return bucket as R2Bucket;
  return undefined;
}

/**
 * A `waitUntil` that never throws.
 *
 * Nitro binds the real one onto the Request (`req.waitUntil`). When nothing is
 * available we simply swallow the promise's rejection — the caller must not
 * depend on the work finishing.
 */
export function getWaitUntil(
  explicitCtx?: unknown,
  request?: Request,
): (promise: Promise<unknown>) => void {
  const fromCtx = (explicitCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined)?.waitUntil;
  const fromRequest = (request as unknown as { waitUntil?: (p: Promise<unknown>) => void } | undefined)
    ?.waitUntil;
  const fromRuntime = (
    request as unknown as {
      runtime?: { cloudflare?: { context?: { waitUntil?: (p: Promise<unknown>) => void } } };
    }
  )?.runtime?.cloudflare?.context?.waitUntil;

  const fn = fromCtx ?? fromRequest ?? fromRuntime;
  if (typeof fn === "function") {
    return (promise: Promise<unknown>) => {
      try {
        fn(promise.catch(() => {}));
      } catch {
        void promise.catch(() => {});
      }
    };
  }
  return (promise: Promise<unknown>) => void promise.catch(() => {});
}

/** Cloudflare's shared edge cache, when we are actually on Cloudflare. */
export function getEdgeCache(): Cache | undefined {
  return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
}
