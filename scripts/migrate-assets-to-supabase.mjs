/**
 * One-off: copy every bundled image from the Lovable asset host into your own
 * Supabase Storage bucket, so the site no longer depends on Lovable.
 *
 * No dependencies — plain Node 18+ (`node scripts/migrate-assets-to-supabase.mjs`).
 *
 * Usage (PowerShell):
 *   $env:LOVABLE_ORIGIN="https://your-project.lovable.app"
 *   $env:SUPABASE_URL="https://ldsnvxmaghkeinfjkpqz.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
 *   node scripts/migrate-assets-to-supabase.mjs
 *
 * Usage (bash):
 *   LOVABLE_ORIGIN="https://your-project.lovable.app" \
 *   SUPABASE_URL="https://ldsnvxmaghkeinfjkpqz.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." \
 *   node scripts/migrate-assets-to-supabase.mjs
 *
 * Files land in:  product-images/catalog/<original-filename>
 * That is exactly where src/server.ts looks when it serves /__l5e/assets-v1/*,
 * so no database rows need to change.
 *
 * Safe to re-run: uploads use upsert, and already-present files are skipped
 * unless FORCE=1 is set.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = path.join(HERE, "..", "src", "assets");
const BUCKET = "product-images";
const FOLDER = "catalog";
const CONCURRENCY = 4;

const LOVABLE_ORIGIN = (process.env.LOVABLE_ORIGIN ?? "").replace(/\/$/, "");
const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const FORCE = process.env.FORCE === "1";

for (const [name, value] of Object.entries({
  LOVABLE_ORIGIN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
})) {
  if (!value) {
    console.error(`\n  Missing environment variable: ${name}\n`);
    process.exit(1);
  }
}

/** Supabase storage needs both headers; new-style keys are not bearer JWTs. */
const authHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
});

function readAssets() {
  return fs
    .readdirSync(ASSET_DIR)
    .filter((f) => f.endsWith(".asset.json"))
    .map((f) => {
      const meta = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, f), "utf8"));
      return {
        filename: meta.original_filename ?? f.replace(/\.asset\.json$/, ""),
        url: meta.url,
        contentType: meta.content_type ?? "application/octet-stream",
        size: meta.size ?? 0,
      };
    })
    .filter((a) => a.url);
}

async function alreadyUploaded(filename) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${FOLDER}/${encodeURIComponent(filename)}`,
    { method: "HEAD" },
  );
  return res.ok;
}

async function migrateOne(asset) {
  if (!FORCE && (await alreadyUploaded(asset.filename))) {
    return { filename: asset.filename, status: "skipped" };
  }

  const source = `${LOVABLE_ORIGIN}${asset.url}`;
  const download = await fetch(source);
  if (!download.ok) {
    return { filename: asset.filename, status: "download-failed", detail: download.status };
  }
  const bytes = new Uint8Array(await download.arrayBuffer());
  if (bytes.byteLength === 0) {
    return { filename: asset.filename, status: "download-failed", detail: "empty body" };
  }

  const upload = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FOLDER}/${encodeURIComponent(asset.filename)}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "content-type": download.headers.get("content-type") ?? asset.contentType,
        "cache-control": "31536000",
        "x-upsert": "true",
      },
      body: bytes,
    },
  );

  if (!upload.ok) {
    return {
      filename: asset.filename,
      status: "upload-failed",
      detail: `${upload.status} ${await upload.text()}`,
    };
  }
  return { filename: asset.filename, status: "uploaded", detail: `${bytes.byteLength} bytes` };
}

async function main() {
  const assets = readAssets();
  console.log(`Found ${assets.length} bundled assets in src/assets`);
  console.log(`Source : ${LOVABLE_ORIGIN}/__l5e/assets-v1/...`);
  console.log(`Target : ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${FOLDER}/\n`);

  const results = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < assets.length) {
      const asset = assets[cursor++];
      const result = await migrateOne(asset);
      results.push(result);
      const mark =
        result.status === "uploaded" ? "OK  " : result.status === "skipped" ? "--  " : "FAIL";
      console.log(
        `${mark} [${results.length}/${assets.length}] ${result.filename}${result.detail ? "  (" + result.detail + ")" : ""}`,
      );
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const tally = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log("\n--- Summary ---");
  for (const [status, count] of Object.entries(tally)) console.log(`${status}: ${count}`);

  const failures = results.filter((r) => r.status.endsWith("failed"));
  if (failures.length) {
    console.log("\nFailed files:");
    for (const f of failures) console.log(`  ${f.filename} — ${f.detail}`);
    console.log(
      "\nIf every download failed, LOVABLE_ORIGIN is wrong or the Lovable project is no longer serving assets.",
    );
    process.exitCode = 1;
  } else {
    console.log("\nAll assets are in Supabase Storage. Images will now load on your own domain.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
