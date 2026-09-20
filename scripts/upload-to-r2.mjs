/**
 * Step 2 of image recovery: push everything in ./image-backup into the
 * Cloudflare R2 bucket `product-images`, under exactly the keys the site
 * asks for.
 *
 * Once this finishes, the site no longer depends on Supabase Storage at all:
 * src/lib/image-serving.ts checks R2 first, and R2 has zero egress fees, which
 * is the whole reason the bucket was introduced.
 *
 * NO DEPENDENCIES beyond wrangler, which is already a devDependency.
 *
 * ── Prerequisites ──────────────────────────────────────────────────────────
 *   npx wrangler login
 *   npx wrangler r2 bucket create product-images      # once, if it is new
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *   node scripts/upload-to-r2.mjs
 *
 * Options (environment variables):
 *   DIR=./some-folder   upload from somewhere other than ./image-backup
 *   PREFIX=catalog      put every file under a key prefix
 *   DRY=1               print what would happen, upload nothing
 *   CONCURRENCY=4       parallel wrangler calls (default 4)
 *
 * Re-running is safe: R2 puts overwrite by key.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const DIR = path.resolve(ROOT, process.env.DIR ?? "image-backup");
const BUCKET = "product-images";
const PREFIX = (process.env.PREFIX ?? "").replace(/^\/+|\/+$/g, "");
const DRY = process.env.DRY === "1";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

if (!fs.existsSync(DIR)) {
  console.error(`Folder not found: ${DIR}
Run  node scripts/download-images.mjs  first, or point DIR at your own folder of images.`);
  process.exit(1);
}

/** Every file under DIR, as { absolute, key } — the key is the path relative to DIR. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(absolute, base));
      continue;
    }
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!CONTENT_TYPES[ext]) continue;
    const relative = path.relative(base, absolute).split(path.sep).join("/");
    out.push({ absolute, key: PREFIX ? `${PREFIX}/${relative}` : relative, ext });
  }
  return out;
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: process.platform === "win32" });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("close", (code) => resolve({ code, stderr }));
    child.on("error", (error) => resolve({ code: 1, stderr: String(error) }));
  });
}

async function upload({ absolute, key, ext }) {
  if (DRY) return { key, ok: true, dry: true };
  const { code, stderr } = await run("npx", [
    "wrangler",
    "r2",
    "object",
    "put",
    `${BUCKET}/${key}`,
    `--file=${absolute}`,
    `--content-type=${CONTENT_TYPES[ext]}`,
    "--remote",
  ]);
  return { key, ok: code === 0, stderr };
}

async function runPool(items, worker, limit) {
  const results = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  });
  await Promise.all(runners);
  return results;
}

const files = walk(DIR);
if (files.length === 0) {
  console.error(`No image files found under ${DIR}.`);
  process.exit(1);
}

console.log(`${DRY ? "[DRY RUN] " : ""}Uploading ${files.length} files to r2://${BUCKET}\n`);

let done = 0;
const results = await runPool(
  files,
  async (file) => {
    const result = await upload(file);
    done += 1;
    console.log(
      `[${String(done).padStart(3)}/${files.length}] ${result.ok ? "✔" : "✘"} ${result.key}`,
    );
    if (!result.ok && result.stderr) console.error(`    ${result.stderr.trim().split("\n")[0]}`);
    return result;
  },
  CONCURRENCY,
);

const failed = results.filter((r) => !r.ok);
console.log(`
──────────────────────────────────────────
  uploaded: ${results.length - failed.length}
  failed  : ${failed.length}
──────────────────────────────────────────
${failed.length ? "Re-run the script; R2 puts are idempotent." : "Done. Check /api/img-status to confirm."}
`);
