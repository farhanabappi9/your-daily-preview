import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

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
 * Legacy asset compatibility
 *
 * Every image URL in this project — the rows in `products.images` and
 * `categories.image`, the bundled catalog in src/lib/products.ts, the
 * category tiles, and the hero cover — points at
 *   /__l5e/assets-v1/<asset-id>/<filename>
 *
 * That path is served by Lovable's own asset host. On a self-hosted
 * Cloudflare Worker nothing answers it, so every image 404s.
 *
 * Rather than rewriting ~120 database rows plus the bundled code, we make
 * the path work here: the asset id is ignored and the file is looked up by
 * filename in the public `product-images` bucket under `catalog/`.
 * Run scripts/migrate-assets-to-supabase.mjs once to populate that folder.
 * ------------------------------------------------------------------ */

const LEGACY_ASSET_PREFIX = "/__l5e/assets-v1/";
const ASSET_FOLDER = "catalog";
const BUCKET = "product-images";

function supabaseBaseUrl(): string | undefined {
  let baked: string | undefined;
  try {
    baked = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  } catch {
    /* import.meta.env unavailable in this runtime */
  }
  const url = baked || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : undefined;
}

async function serveLegacyAsset(pathname: string): Promise<Response> {
  const filename = decodeURIComponent(pathname.split("/").pop() ?? "");
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return new Response("Not found", { status: 404 });
  }

  const base = supabaseBaseUrl();
  if (!base) {
    console.error("[assets] SUPABASE_URL is not configured — cannot serve", pathname);
    return new Response("Storage not configured", { status: 500 });
  }

  const target = `${base}/storage/v1/object/public/${BUCKET}/${ASSET_FOLDER}/${encodeURIComponent(filename)}`;

  try {
    const upstream = await fetch(target);
    if (!upstream.ok || !upstream.body) {
      console.error(`[assets] ${filename} -> ${upstream.status} from storage`);
      return new Response("Not found", { status: 404 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[assets] fetch failed for", filename, error);
    return new Response("Not found", { status: 404 });
  }
}

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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname.startsWith(LEGACY_ASSET_PREFIX)) {
        return await serveLegacyAsset(pathname);
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
