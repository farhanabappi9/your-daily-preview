/**
 * Responsive image helpers.
 *
 * Product images are served from the platform asset host, which does not
 * resize on the fly. If an image CDN that supports width transforms is
 * configured through `VITE_IMG_CDN` (e.g. "https://cdn.example.com/cdn-cgi/image"),
 * we emit a real `srcset` with multiple widths; otherwise we emit a single
 * candidate carrying the intrinsic width so the browser can still make a
 * smart decision together with `sizes`.
 */

const CDN = (import.meta.env.VITE_IMG_CDN as string | undefined)?.replace(/\/$/, "");

export const DEFAULT_WIDTHS = [200, 320, 480, 640, 900, 1200, 1600];

function variant(src: string, width: number) {
  if (!CDN) return src;
  const abs = src.startsWith("http")
    ? src
    : `${typeof window !== "undefined" ? window.location.origin : ""}${src}`;
  return `${CDN}/width=${width},format=auto,quality=80/${abs}`;
}

/** Build a srcset string for an image URL. */
export function buildSrcSet(
  src: string,
  intrinsicWidth?: number,
  widths: number[] = DEFAULT_WIDTHS,
) {
  if (!src) return undefined;
  const max = intrinsicWidth ?? widths[widths.length - 1];
  if (!CDN) return `${src} ${max}w`;
  const list = widths.filter((w) => w <= max);
  if (list[list.length - 1] !== max) list.push(max);
  return list.map((w) => `${variant(src, w)} ${w}w`).join(", ");
}

/** Common `sizes` presets so every surface stays consistent. */
export const SIZES = {
  card: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px",
  listThumb: "(max-width: 640px) 30vw, 150px",
  hero: "100vw",
  gallery: "(max-width: 1024px) 100vw, 600px",
  thumb: "80px",
  tiny: "56px",
} as const;
