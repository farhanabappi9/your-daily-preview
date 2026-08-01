/**
 * Maps a bundled asset filename to its current platform asset URL.
 *
 * Image URLs stored in the database were minted for an older asset store, so
 * they 404 today. Every one of those files also ships as an `*.asset.json`
 * pointer in `src/assets`, so we can recover the live URL by filename.
 */
const modules = import.meta.glob<{ url: string; original_filename?: string }>(
  "../assets/*.asset.json",
  { eager: true, import: "default" },
);

const urlByFilename = new Map<string, string>();
for (const [path, mod] of Object.entries(modules)) {
  const filename = mod?.original_filename ?? path.split("/").pop()!.replace(/\.asset\.json$/, "");
  if (mod?.url) urlByFilename.set(filename, mod.url);
}

/** Resolve a stored image reference to a URL that is actually served today. */
export function resolveAssetUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (!src.includes("/__l5e/assets-v1/")) return src;
  const filename = src.split("/").pop() ?? "";
  return urlByFilename.get(filename) ?? src;
}
