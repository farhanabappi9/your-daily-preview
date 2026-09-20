import { createFileRoute } from "@tanstack/react-router";
import { objectKeyFromPath, placeholderResponse, resolveImage } from "@/lib/image-serving";

/**
 * Serves /api/public/img/<key>.
 *
 * In production `src/server.ts` intercepts this path before the router ever
 * sees it, so this route is a safety net for any runtime where the custom
 * server entry is bypassed (some dev setups, `vite preview`, node adapters).
 * It deliberately shares the exact same resolver, so both paths behave
 * identically — R2 first, then Supabase, then the legacy origins, then a
 * placeholder instead of a broken image.
 */
export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const pathname = new URL(request.url).pathname;
        const key = objectKeyFromPath(pathname);
        if (!key) return placeholderResponse("Ahsan Fashion");
        return resolveImage(key, { request, pathname });
      },
    },
  },
});
