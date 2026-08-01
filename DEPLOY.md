# Deployment: নিজের Supabase + Cloudflare (custom domain)

সব ডেটা ইতিমধ্যেই Supabase-এ (`products`, `categories`, `orders`, `order_items`,
`order_status_history`, `coupons`, `banners`, `settings`, `user_roles`) — তাই কোড
পরিবর্তন লাগে না, শুধু নতুন প্রজেক্টে স্কিমা + ডেটা নিতে হবে এবং Cloudflare-এ ডিপ্লয় করতে হবে।

---

## ১. নতুন Supabase প্রজেক্ট

1. https://supabase.com/dashboard → **New project** (region: **Singapore**)
2. Project Settings → **API keys** থেকে সংগ্রহ করুন:
   - Project URL → `SUPABASE_URL`
   - `publishable` key → `SUPABASE_PUBLISHABLE_KEY`
   - `secret` / service_role key → `SUPABASE_SERVICE_ROLE_KEY` (গোপন, কখনো ফ্রন্টএন্ডে নয়)

## ২. স্কিমা প্রয়োগ

1. Storage → **New bucket** → নাম `product-images`, **Public** ✅ (আগে বানাতে হবে, নইলে
   storage policy গুলো ফেল করবে)
2. SQL Editor-এ `supabase/schema.sql` ফাইলটির পুরো কনটেন্ট paste করে **Run**
   (এটি `supabase/migrations/` এর তিনটি ফাইলের একত্রিত রূপ)

## ৩. অ্যাডমিন ইউজার

Auth users পুরোনো প্রজেক্ট থেকে কপি হয় না — নতুন করে বানাতে হবে:

1. Authentication → Users → **Add user** (email + password, "Auto confirm" ✅)
2. SQL Editor-এ:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'your@email.com';
```

## ৪. ডেটা মাইগ্রেশন (পুরোনো → নতুন)

```bash
OLD_SUPABASE_URL="https://dvuaekdqlrevmaaybsxb.supabase.co" \
OLD_SERVICE_ROLE_KEY="<পুরোনো প্রজেক্টের service role key>" \
NEW_SUPABASE_URL="https://<new-ref>.supabase.co" \
NEW_SERVICE_ROLE_KEY="<নতুন প্রজেক্টের service role key>" \
bun run scripts/migrate-data.ts
```

স্ক্রিপ্টটি টেবিলগুলো নির্ভরতার ক্রমে কপি করে (id / order_no / timestamp অপরিবর্তিত),
`product-images` bucket-এর সব ফাইল কপি করে, শেষে প্রতিটি টেবিলের row count দেখায়।
বারবার চালানো নিরাপদ (upsert)।

## ৫. লোকাল `.env` নতুন প্রজেক্টে পয়েন্ট করুন

```
SUPABASE_URL="https://<new-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
SUPABASE_PROJECT_ID="<new-ref>"
VITE_SUPABASE_URL="https://<new-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
VITE_SUPABASE_PROJECT_ID="<new-ref>"
```

## ৬. Cloudflare Workers-এ ডিপ্লয়

`wrangler.toml` রেডি আছে (`main`/`assets` বিল্ড নিজেই জেনারেট করে)।

```bash
npx wrangler login
npm run build
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

> `VITE_*` ভ্যালুগুলো **বিল্ড টাইমে** bundle-এ ঢোকে, তাই build চালানোর মেশিনে/CI-তে
> `.env` বা env vars থাকতে হবে। `SUPABASE_SERVICE_ROLE_KEY` শুধুই Worker secret।

**Git-connected বিল্ড (বিকল্প):** Cloudflare Dashboard → Workers & Pages → Import
repository → Build command `npm run build`, Deploy command `npx wrangler deploy`;
Settings → Variables-এ উপরের সব ভ্যারিয়েবল (VITE_* সহ) যোগ করুন।

## ৭. Custom domain

1. Cloudflare-এ ডোমেইন যোগ → registrar-এ nameserver পরিবর্তন
2. Worker → Settings → **Domains & Routes** → Add custom domain: `example.com` এবং `www.example.com`
3. SSL/TLS → **Full (strict)**, **Always Use HTTPS** চালু
4. Supabase → Authentication → **URL Configuration** → Site URL = `https://example.com`,
   Redirect URLs-এ `https://example.com/**` যোগ করুন

## ৮. চেকলিস্ট (নতুন ডোমেইনে)

- [ ] হোম/শপ/ক্যাটাগরি/প্রোডাক্ট পেজ ও ছবি লোড হচ্ছে
- [ ] কার্ট + কুপন + চেকআউট → অর্ডার তৈরি হচ্ছে, thank-you পেজে order no দেখাচ্ছে
- [ ] `/login` দিয়ে অ্যাডমিন লগইন
- [ ] অ্যাডমিন: অর্ডার লিস্ট, স্ট্যাটাস আপডেট, ইনভয়েস প্রিন্ট
- [ ] অ্যাডমিন: প্রোডাক্ট এডিট + ইমেজ আপলোড
