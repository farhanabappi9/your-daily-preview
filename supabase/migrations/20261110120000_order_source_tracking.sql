-- =====================================================================
-- অর্ডারের সোর্স (TikTok / Facebook / Google …), ডুপ্লিকেট-রোধ এবং
-- server-side tracking-এর গোপন key রাখার টেবিল।
--
-- Supabase Dashboard → SQL Editor-এ পুরোটা paste করে একবার Run করুন।
-- বারবার চালালেও সমস্যা নেই (IF NOT EXISTS / OR REPLACE)।
-- =====================================================================

-- ---------- 1. orders: সোর্স + attribution + duplicate token ----------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_medium text,
  ADD COLUMN IF NOT EXISTS attribution jsonb,
  ADD COLUMN IF NOT EXISTS checkout_token text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS server_events jsonb;

-- একই checkout token দিয়ে দুইবার অর্ডার ঢুকতেই পারবে না (ডাবল ক্লিক / নেট রিট্রাই)
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_token_key
  ON public.orders (checkout_token)
  WHERE checkout_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_source_idx ON public.orders (source, created_at DESC);
-- ডুপ্লিকেট চেক দ্রুত করার জন্য (একই ফোন, কয়েক মিনিটের মধ্যে)
CREATE INDEX IF NOT EXISTS orders_phone_created_idx ON public.orders (phone, created_at DESC);

-- ---------- 2. private_settings: শুধু admin দেখতে/লিখতে পারবে ----------
-- Facebook Conversions API token, TikTok Events API token, GA4 API secret এখানে থাকে।
-- `settings` টেবিল সবার জন্য পড়া যায় (দোকানের নাম, ফোন ইত্যাদি), তাই গোপন key
-- সেখানে রাখা যাবে না।
CREATE TABLE IF NOT EXISTS public.private_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.private_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_settings TO authenticated;
GRANT ALL ON public.private_settings TO service_role;
ALTER TABLE public.private_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "private settings admin read" ON public.private_settings;
CREATE POLICY "private settings admin read" ON public.private_settings
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "private settings admin write" ON public.private_settings;
CREATE POLICY "private settings admin write" ON public.private_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS private_settings_updated ON public.private_settings;
CREATE TRIGGER private_settings_updated BEFORE UPDATE ON public.private_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PostgREST যেন নতুন column/টেবিল সাথে সাথে চিনে নেয়
NOTIFY pgrst, 'reload schema';
