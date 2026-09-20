/**
 * Step 1 of image recovery: collect every image this site references and pull
 * it down from whichever origin still has it, into ./image-backup.
 *
 * WHY YOU NEED THIS
 * -----------------
 * The project has lived on three Supabase projects:
 *   ldsnvxmaghkeinfjkpqz -> xvxmydbhhpxiemmpahzo -> fpmeidfyupqunuwtynso (now)
 * The SQL rows were carried over each time. Supabase Storage objects were not —
 * a SQL export never contains the storage bucket. So `products.images` and
 * `categories.image` still point at files that only exist in the older
 * projects (or on the Lovable preview host).
 *
 * This script asks the CURRENT database what files it needs, then hunts for
 * each one across every origin you give it.
 *
 * NO DEPENDENCIES — plain Node 18+.
 *
 * ── Usage (bash / macOS / Linux) ───────────────────────────────────────────
 *   SUPABASE_URL="https://fpmeidfyupqunuwtynso.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   SOURCE_ORIGINS="https://ldsnvxmaghkeinfjkpqz.supabase.co,https://xvxmydbhhpxiemmpahzo.supabase.co" \
 *   LOVABLE_ORIGIN="https://your-project.lovable.app" \
 *   node scripts/download-images.mjs
 *
 * ── Usage (Windows PowerShell) ─────────────────────────────────────────────
 *   $env:SUPABASE_URL="https://fpmeidfyupqunuwtynso.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   $env:SOURCE_ORIGINS="https://ldsnvxmaghkeinfjkpqz.supabase.co"
 *   $env:LOVABLE_ORIGIN="https://your-project.lovable.app"
 *   node scripts/download-images.mjs
 *
 * SOURCE_ORIGINS and LOVABLE_ORIGIN are both optional — the current project is
 * always tried first. If you only have the old Supabase URL, that is enough.
 * If an old project is already deleted, leave it out; anything still missing at
 * the end is listed in image-backup/_missing.txt so you know exactly what has
 * to be re-uploaded by hand.
 *
 * Safe to re-run: already-downloaded files are skipped unless FORCE=1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const ASSET_DIR = path.join(ROOT, "src", "assets");
const OUT_DIR = path.join(ROOT, "image-backup");
const BUCKET = "product-images";
const ASSET_FOLDER = "catalog";
const CONCURRENCY = 6;

const trim = (v) => (v ?? "").replace(/\/+$/, "");
const SUPABASE_URL = trim(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SOURCE_ORIGINS = (process.env.SOURCE_ORIGINS ?? "")
  .split(",")
  .map((s) => trim(s.trim()))
  .filter((s) => s.startsWith("http"));
const LOVABLE_ORIGIN = trim(process.env.LOVABLE_ORIGIN);
const FORCE = process.env.FORCE === "1";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (the CURRENT project).");
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* 1. Work out every file the site needs                            */
/* ---------------------------------------------------------------- */

/** `/api/public/img/x.png` -> `x.png`;  `/__l5e/assets-v1/<id>/y.jpg` -> `catalog/y.jpg` */
function toKey(ref) {
  if (typeof ref !== "string" || !ref) return null;
  if (ref.startsWith("/__l5e/assets-v1/")) {
    const filename = decodeURIComponent(ref.split("/").pop() ?? "");
    return filename ? `${ASSET_FOLDER}/${filename}` : null;
  }
  if (ref.startsWith("/api/public/img/")) {
    const key = decodeURIComponent(ref.slice("/api/public/img/".length));
    return key && !key.includes("..") ? key : null;
  }
  return null; // absolute external URLs need no recovery
}

async function queryTable(table, columns) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns}`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    console.warn(`  ! could not read ${table}: ${res.status} ${await res.text().catch(() => "")}`);
    return [];
  }
  return res.json();
}

async function collectKeys() {
  const refs = new Set();

  console.log("Reading the current database for image references…");

  for (const row of await queryTable("products", "images")) {
    for (const image of row.images ?? []) refs.add(image);
  }
  for (const row of await queryTable("categories", "image")) {
    if (row.image) refs.add(row.image);
  }
  // These tables may not exist on every deployment — failures are warned, not fatal.
  for (const row of await queryTable("banners", "image")) {
    if (row.image) refs.add(row.image);
  }
  for (const row of await queryTable("shop_settings", "logo")) {
    if (row.logo) refs.add(row.logo);
  }

  // Bundled catalog art (logo, hero cover, category tiles, seeded products).
  if (fs.existsSync(ASSET_DIR)) {
    for (const file of fs.readdirSync(ASSET_DIR)) {
      if (!file.endsWith(".asset.json")) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, file), "utf8"));
        if (meta.url) refs.add(meta.url);
      } catch {
        /* skip unreadable pointer */
      }
    }
  }

  const map = new Map(); // key -> original ref (needed for the Lovable fallback)
  for (const ref of refs) {
    const key = toKey(ref);
    if (key && !map.has(key)) map.set(key, ref);
  }
  return map;
}

/* ---------------------------------------------------------------- */
/* 2. Try every origin for each file                                */
/* ---------------------------------------------------------------- */

function candidateKeys(key) {
  const keys = [key];
  if (!key.includes("/")) keys.push(`${ASSET_FOLDER}/${key}`);
  if (key.startsWith(`${ASSET_FOLDER}/`)) keys.push(key.slice(ASSET_FOLDER.length + 1));
  return [...new Set(keys)];
}

function* sources(key, originalRef) {
  const allOrigins = [SUPABASE_URL, ...SOURCE_ORIGINS];
  for (const origin of allOrigins) {
    for (const candidate of candidateKeys(key)) {
      const encoded = candidate.split("/").map(encodeURIComponent).join("/");
      yield {
        label: new URL(origin).hostname,
        url: `${origin}/storage/v1/object/public/${BUCKET}/${encoded}`,
        headers: undefined,
      };
      if (SERVICE_KEY && origin === SUPABASE_URL) {
        yield {
          label: `${new URL(origin).hostname} (authed)`,
          url: `${origin}/storage/v1/object/${BUCKET}/${encoded}`,
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        };
      }
    }
  }
  if (LOVABLE_ORIGIN && originalRef?.startsWith("/__l5e/")) {
    yield { label: "lovable", url: `${LOVABLE_ORIGIN}${originalRef}`, headers: undefined };
  }
}

async function downloadOne(key, originalRef) {
  const target = path.join(OUT_DIR, key);
  if (!FORCE && fs.existsSync(target) && fs.statSync(target).size > 0) {
    return { key, status: "skipped" };
  }

  for (const source of sources(key, originalRef)) {
    try {
      const res = await fetch(source.url, source.headers ? { headers: source.headers } : undefined);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buffer);
      return { key, status: "downloaded", from: source.label, bytes: buffer.length };
    } catch {
      /* try the next source */
    }
  }
  return { key, status: "missing" };
}

async function runPool(items, worker, limit) {
  const results = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ---------------------------------------------------------------- */

const keyMap = await collectKeys();
const entries = [...keyMap.entries()];
console.log(`Found ${entries.length} distinct image files to recover.\n`);
fs.mkdirSync(OUT_DIR, { recursive: true });

let done = 0;
const results = await runPool(
  entries,
  async ([key, ref]) => {
    const result = await downloadOne(key, ref);
    done += 1;
    const mark = result.status === "downloaded" ? "✔" : result.status === "skipped" ? "·" : "✘";
    const suffix = result.from ? ` <- ${result.from}` : "";
    console.log(`[${String(done).padStart(3)}/${entries.length}] ${mark} ${key}${suffix}`);
    return result;
  },
  CONCURRENCY,
);

const downloaded = results.filter((r) => r.status === "downloaded");
const skipped = results.filter((r) => r.status === "skipped");
const missing = results.filter((r) => r.status === "missing");

fs.writeFileSync(
  path.join(OUT_DIR, "_missing.txt"),
  missing.map((r) => `${r.key}\t${keyMap.get(r.key)}`).join("\n") + "\n",
  "utf8",
);

console.log(`
──────────────────────────────────────────
  downloaded : ${downloaded.length}
  already had: ${skipped.length}
  MISSING    : ${missing.length}
──────────────────────────────────────────
Files are in: ${OUT_DIR}
${missing.length ? `Files no origin still has are listed in image-backup/_missing.txt —
those have to be re-uploaded from your own copies through the admin panel.` : "Everything was recovered."}

Next: node scripts/upload-to-r2.mjs
`);
