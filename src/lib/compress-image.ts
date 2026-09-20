/**
 * Resize + convert an image to WebP entirely in the browser before upload.
 * A typical 3–8MB phone photo comes down to ~100–300KB with no visible
 * quality loss — this directly cuts R2 storage AND page-load bandwidth
 * for every visitor of the shop.
 */
export async function compressImage(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number },
): Promise<File> {
  const maxWidth = options?.maxWidth ?? 1600;
  const maxHeight = options?.maxHeight ?? 1600;
  const quality = options?.quality ?? 0.82;

  // Skip tiny files and formats that shouldn't be touched (SVG icons,
  // animated GIFs — re-encoding as a static WebP would break them).
  if (file.size < 80_000 || file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // unsupported/corrupt image — upload as-is
  }

  let width = bitmap.width;
  let height = bitmap.height;

  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    bitmap.close?.();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });

  // Very old browsers silently ignore "image/webp" and may return null
  // or a non-webp blob — bail out safely to the original file.
  if (!blob || blob.type !== "image/webp" || blob.size >= file.size) {
    return file;
  }

  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], newName, { type: "image/webp" });
}