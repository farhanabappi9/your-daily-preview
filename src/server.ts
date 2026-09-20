import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  BUCKET,
  IMG_PREFIX,
  IMG_UPLOAD_PATH,
  LEGACY_ASSET_PREFIX,
  currentSupabaseUrl,
  guessContentType,
  objectKeyFromPath,
  placeholderResponse,
  resolveImage,
  serviceRoleKey,
} from "./lib/image-serving";
import { imageStatusResponse } from "./lib/image-diagnostics";
import { getProductImagesBucket, getWorkerEnv } from "./lib/worker-runtime";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/* ------------------------------------------------------------------ *
 * Images
 *
 * Two URL shapes reach us:
 *
 *   /__l5e/assets-v1/<asset-id>/<file>  — the bundled catalog art (logo, hero
 *                                         cover, category tiles, the seeded
 *                                         product photos). Minted by Lovable's
 *                                         asset host, which nothing answers on
 *                                         a self-hosted Worker.
 *   /api/public/img/<key>               — everything uploaded from the admin
 *                                         panel.
 *
 * Both are normalised to a single object key and resolved by
 * src/lib/image-serving.ts, which tries R2 -> Supabase -> old Supabase
 * projects -> Lovable, and backfills R2 with whatever it finds.
 *
 * NOTE: `env` and `ctx` below are undefined in production — Nitro calls this
 * module's fetch with the Request only. They are still accepted so the same
 * file works when it *is* called with all three, and every consumer goes
 * through getWorkerEnv(), which knows where Nitro really keeps the bindings.
 * ------------------------------------------------------------------ */

async function handleImageUpload(request: Request, env: unknown): Promise<Response> {
  const workerEnv = getWorkerEnv(env, request);

  if (!(await requireAdminToken(request, workerEnv))) {
    return json({ error: "Unauthorized" }, 401);
  }

  let file: File;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (!(candidate instanceof File)) return json({ error: "No file provided" }, 400);
    file = candidate;
  } catch (error) {
    console.error("[img] could not read upload form", error);
    return json({ error: "Upload failed" }, 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType = file.type || guessContentType(key);
  const bytes = await file.arrayBuffer();

  // 1. R2 — the intended destination.
  const bucket = getProductImagesBucket(env, request);
  if (bucket) {
    try {
      await bucket.put(key, bytes, { httpMetadata: { contentType } });
      return json({ path: key, storedIn: "r2" });
    } catch (error) {
      console.error("[img] R2 upload failed, falling back to Supabase", error);
    }
  }

  // 2. Supabase Storage — so uploading still works before R2 is set up, and
  //    in local dev where there is no binding at all.
  const base = currentSupabaseUrl(workerEnv);
  const key2 = serviceRoleKey(workerEnv);
  if (base && key2) {
    try {
      const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
          apikey: key2,
          Authorization: `Bearer ${key2}`,
          "content-type": contentType,
          "cache-control": "31536000",
        },
        body: bytes,
      });
      if (res.ok) return json({ path: key, storedIn: "supabase" });
      console.error("[img] Supabase upload failed", res.status, await res.text().catch(() => ""));
    } catch (error) {
      console.error("[img] Supabase upload threw", error);
    }
  }

  return json(
    {
      error:
        "Upload failed: neither the R2 binding (PRODUCT_IMAGES) nor Supabase Storage accepted the file. Check /api/img-status.",
    },
    500,
  );
}

/** Same Bearer-token check as requireSupabaseAuth, without the TanStack middleware wrapper. */
async function requireAdminToken(
  request: Request,
  workerEnv: ReturnType<typeof getWorkerEnv>,
): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);
  if (!token || token.split(".").length !== 3) return false;

  const base = currentSupabaseUrl(workerEnv);
  let key: string | undefined;
  try {
    key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  } catch {
    /* import.meta.env unavailable in this runtime */
  }
  key = key || workerEnv.SUPABASE_PUBLISHABLE_KEY || workerEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return false;

  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/* ------------------------------------------------------------------ *
 * SSR error normalisation (unchanged)
 * ------------------------------------------------------------------ */

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */

export default {
  async fetch(request: Request, env?: unknown, ctx?: unknown) {
    try {
      const pathname = new URL(request.url).pathname;

      // Diagnostics. Handled here rather than as a file route so it keeps
      // working even when the router or the rest of the app is broken.
      if (request.method === "GET" && pathname === "/api/img-status") {
        return await imageStatusResponse(request, env);
      }

      if (request.method === "POST" && pathname === IMG_UPLOAD_PATH) {
        return await handleImageUpload(request, env);
      }

      const isImagePath =
        pathname.startsWith(LEGACY_ASSET_PREFIX) ||
        (pathname.startsWith(IMG_PREFIX) && pathname !== IMG_UPLOAD_PATH);

      if (isImagePath && (request.method === "GET" || request.method === "HEAD")) {
        const key = objectKeyFromPath(pathname);
        if (!key) return placeholderResponse("Ahsan Fashion");
        const response = await resolveImage(key, { env, ctx, request, pathname });
        if (request.method === "HEAD") {
          return new Response(null, { status: response.status, headers: response.headers });
        }
        return response;
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
