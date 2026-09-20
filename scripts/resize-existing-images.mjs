/**
 * One-off: resize + re-encode every EXISTING product/category/banner image
 * to WebP, IN PLACE — same URL, same database row, only smaller bytes.
 *
 * Why this is safe without touching the database or src/server.ts:
 *   - Admin-uploaded images are served from R2 at /api/public/img/<key>.
 *     The Worker sets the response Content-Type from the object's stored
 *     metadata, not from the file extension in <key>. Overwriting the R2
 *     object's bytes (new WebP data + new content-type metadata) under the
 *     exact same key works with zero code or DB changes.
 *   - Bundled catalog images are served from Supabase Storage at
 *     catalog/<filename> for every /__l5e/assets-v1/.../<filename> URL,
 *     matched by filename only. Overwriting that same Storage object works
 *     the same way.
 *
 * One-time setup:
 *   npm install --save-dev sharp
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
 *   $env:SITE_ORIGIN="https://project-preview-pro.farhanabappi9.workers.dev"
 *   node scripts/resize-existing-images.mjs
 *
 * Usage (bash):
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." \
 *   SITE_ORIGIN="https://project-preview-pro.farhanabappi9.workers.dev" \
 *   node scripts/resize-existing-images.mjs
 *
 * Safe to re-run: already-small or already-optimized images are skipped.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SUPABASE_URL = must("SUPABASE_URL").replace(/\/$/, "");
const SERVICE_KEY = must("SUPABASE_SERVICE_ROLE_KEY");
const SITE_ORIGIN = must("SITE_ORIGIN").replace(/\/$/, "");

const BUCKET = "product-images";
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const QUALITY = 82;
const MIN_SIZE_TO_TOUCH = 80_000; // skip files already under ~80KB
const CONCURRENCY = 3;

function must(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`\n  Missing environment variable: ${name}\n`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Paginated read of one column from one table. */
async function fetchColumn(table, column) {
  const pageSize = 500;
  let offset = 0;
  const out = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`read ${table}.${column}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    offset += data.length;
    if (data.length < pageSize) break;
  }
  return out;
}

/** Pull every image URL referenced by products, categories and banners. */
async function collectImageUrls() {
  const urls = new Set();

  for (const row of await fetchColumn("products", "images")) {
    for (const u of row.images ?? []) if (u) urls.add(u);
  }
  for (const row of await fetchColumn("categories", "image")) {
    if (row.image) urls.add(row.image);
  }
  for (const row of await fetchColumn("banners", "image")) {
    if (row.image) urls.add(row.image);
  }

  return [...urls];
}

/**
 * Classify a stored image URL into where its bytes actually live.
 * Returns null for images we don't control (pasted external URLs).
 */
function classify(url) {
  if (url.startsWith("/api/public/img/") && url !== "/api/public/img/upload") {
    return { kind: "r2", key: url.slice("/api/public/img/".length) };
  }
  if (url.startsWith("/__l5e/assets-v1/")) {
    const filename = decodeURIComponent(url.split("/").pop() ?? "");
    if (!filename) return null;
    return { kind: "supabase-catalog", filename };
  }
  return null;
}

async function fetchOriginal(url) {
  const res = await fetch(`${SITE_ORIGIN}${url}`);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function resizeToWebp(bytes) {
  return sharp(bytes)
    .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
}

function putToR2(key, bytes, tmpDir) {
  const tmpFile = path.join(tmpDir, `u-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`);
  writeFileSync(tmpFile, bytes);
  try {
    execFileSync(
      "npx",
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `${BUCKET}/${key}`,
        "--file",
        tmpFile,
        "--content-type",
        "image/webp",
        "--remote",
      ],
      { stdio: "pipe", shell: process.platform === "win32" },
    );
  } catch (error) {
    const detail = error.stderr?.toString() || error.stdout?.toString() || error.message;
    throw new Error(`wrangler r2 put failed: ${detail}`);
  }
}

async function putToSupabaseCatalog(filename, bytes) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/catalog/${encodeURIComponent(filename)}`,
    {
      method: "PUT",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "image/webp",
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    throw new Error(`Supabase storage PUT catalog/${filename} -> ${res.status} ${await res.text()}`);
  }
}

async function processOne(url, tmpDir, stats) {
  const target = classify(url);
  if (!target) {
    stats.skippedExternal++;
    return;
  }
  try {
    const original = await fetchOriginal(url);
    if (original.length < MIN_SIZE_TO_TOUCH) {
      stats.skippedSmall++;
      return;
    }
    const resized = await resizeToWebp(original);
    if (resized.length >= original.length) {
      stats.skippedNoGain++;
      return;
    }
    if (target.kind === "r2") {
      putToR2(target.key, resized, tmpDir);
    } else {
      await putToSupabaseCatalog(target.filename, resized);
    }
    stats.converted++;
    stats.bytesBefore += original.length;
    stats.bytesAfter += resized.length;
    console.log(
      `  ✓ ${url}  ${(original.length / 1024).toFixed(0)}KB -> ${(resized.length / 1024).toFixed(0)}KB`,
    );
  } catch (error) {
    stats.failed++;
    console.error(`  ✗ ${url}  ${error.message}`);
  }
}

async function main() {
  const urls = await collectImageUrls();
  console.log(`Found ${urls.length} distinct image URLs referenced in the database.\n`);

  const tmpDir = mkdtempSync(path.join(tmpdir(), "resize-images-"));
  const stats = {
    converted: 0,
    skippedExternal: 0,
    skippedSmall: 0,
    skippedNoGain: 0,
    failed: 0,
    bytesBefore: 0,
    bytesAfter: 0,
  };

  let index = 0;
  async function worker() {
    while (index < urls.length) {
      const url = urls[index++];
      await processOne(url, tmpDir, stats);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  rmSync(tmpDir, { recursive: true, force: true });

  const beforeMB = stats.bytesBefore / 1024 / 1024;
  const savedMB = (stats.bytesBefore - stats.bytesAfter) / 1024 / 1024;

  console.log("\nDone.");
  console.log(`  Converted:               ${stats.converted}`);
  console.log(`  Skipped (already small): ${stats.skippedSmall}`);
  console.log(`  Skipped (external URL):  ${stats.skippedExternal}`);
  console.log(`  Skipped (no size gain):  ${stats.skippedNoGain}`);
  console.log(`  Failed:                  ${stats.failed}`);
  console.log(`  Total before: ${beforeMB.toFixed(1)}MB  ->  saved ~${savedMB.toFixed(1)}MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});