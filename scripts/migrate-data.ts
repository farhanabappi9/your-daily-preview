/**
 * One-off data migration: old Supabase project -> your own Supabase project.
 *
 * Usage:
 *   OLD_SUPABASE_URL=... OLD_SERVICE_ROLE_KEY=... \
 *   NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... \
 *   bun run scripts/migrate-data.ts
 *
 * Copies every row (ids, order numbers and timestamps preserved) plus the
 * `product-images` storage bucket. Safe to re-run: everything is upserted.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const OLD_URL = must("OLD_SUPABASE_URL");
const OLD_KEY = must("OLD_SERVICE_ROLE_KEY");
const NEW_URL = must("NEW_SUPABASE_URL");
const NEW_KEY = must("NEW_SERVICE_ROLE_KEY");

const BUCKET = "product-images";

/** Order matters: parents before children (foreign keys). */
const TABLES = [
  "categories",
  "products",
  "coupons",
  "banners",
  "settings",
  "orders",
  "order_items",
  "order_status_history",
  "user_roles",
] as const;

/** Tables keyed by something other than `id`. */
const CONFLICT_KEY: Record<string, string> = { settings: "key" };

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const from = client(OLD_URL, OLD_KEY);
const to = client(NEW_URL, NEW_KEY);

async function copyTable(table: string) {
  const pageSize = 500;
  let offset = 0;
  let copied = 0;

  for (;;) {
    const { data, error } = await from
      .from(table)
      .select("*")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    const { error: writeError } = await to
      .from(table)
      .upsert(data, { onConflict: CONFLICT_KEY[table] ?? "id" });
    if (writeError) throw new Error(`write ${table}: ${writeError.message}`);

    copied += data.length;
    offset += data.length;
    if (data.length < pageSize) break;
  }

  const { count } = await to.from(table).select("*", { count: "exact", head: true });
  console.log(
    `  ${table.padEnd(22)} copied ${String(copied).padStart(5)}  -> target now has ${count ?? "?"}`,
  );
}

async function listFiles(prefix = ""): Promise<string[]> {
  const { data, error } = await from.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list storage ${prefix}: ${error.message}`);
  const out: string[] = [];
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) out.push(...(await listFiles(path)));
    else out.push(path);
  }
  return out;
}

async function copyStorage() {
  let files: string[];
  try {
    files = await listFiles();
  } catch (e) {
    console.log(`  storage skipped: ${(e as Error).message}`);
    return;
  }
  console.log(`  ${files.length} file(s) in ${BUCKET}`);
  for (const path of files) {
    const { data, error } = await from.storage.from(BUCKET).download(path);
    if (error || !data) {
      console.warn(`  ! download failed ${path}: ${error?.message}`);
      continue;
    }
    const { error: upErr } = await to.storage
      .from(BUCKET)
      .upload(path, await data.arrayBuffer(), { contentType: data.type, upsert: true });
    if (upErr) console.warn(`  ! upload failed ${path}: ${upErr.message}`);
  }
  console.log("  storage done");
}

async function main() {
  console.log(`Migrating ${OLD_URL} -> ${NEW_URL}\n`);
  console.log("Tables:");
  for (const table of TABLES) await copyTable(table);
  console.log("\nStorage:");
  await copyStorage();
  console.log("\nDone. Auth users are NOT copied - see DEPLOY.md step 3.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
