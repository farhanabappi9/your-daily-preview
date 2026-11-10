-- =====================================================================
-- পুরনো অর্ডারের সোর্স বসানো (ট্র্যাকিং চালুর আগের অর্ডার)
--
-- সত্যি কথা: আগের ওয়েবসাইট অর্ডারের সাথে কোনো সোর্স চিহ্ন (fbclid, utm,
-- ব্রাউজার, referrer) সেভ করত না। তাই পুরনো অর্ডারের "নিশ্চিত" সোর্স ডাটাবেস
-- থেকে বের করা সম্ভব না। এই SQL যতটুকু চিহ্ন আছে সেটা দিয়ে বসায়, বাকিগুলো
-- আপনার বলা মূল সোর্স (Facebook) ধরে "আনুমানিক" হিসেবে বসায়।
-- Admin প্যানেলে এগুলো ডট-বর্ডার আর "· আনুমানিক" লেখা দিয়ে আলাদা দেখাবে,
-- যাতে আসল ট্র্যাক করা অর্ডারের সাথে গুলিয়ে না যায়।
--
-- আগে চালাতে হবে: 20261110120000_order_source_tracking.sql
-- বারবার চালানো যাবে — নতুন ট্র্যাক করা অর্ডার যত বাড়বে, ধাপ ১ তত বেশি
-- পুরনো অর্ডার "একই কাস্টমার" দিয়ে ঠিক করবে। আসল ট্র্যাক করা অর্ডার কখনো বদলায় না।
-- =====================================================================

-- ---------- ধাপ ১: একই ফোন নম্বরের কাস্টমার পরে ট্র্যাক হওয়া অর্ডার দিলে ----------
-- সেই অর্ডারের সোর্স তার পুরনো অর্ডারেও বসে (সবচেয়ে কাছের ট্র্যাক করা অর্ডার)।
WITH tracked AS (
  SELECT DISTINCT ON (right(regexp_replace(phone, '\D', '', 'g'), 10))
         right(regexp_replace(phone, '\D', '', 'g'), 10) AS ph,
         source, source_medium, order_no
  FROM public.orders
  WHERE source IS NOT NULL
    AND source <> 'direct'
    AND coalesce(attribution->>'detected_by', '') NOT LIKE 'legacy_%'
  ORDER BY right(regexp_replace(phone, '\D', '', 'g'), 10), created_at ASC
)
UPDATE public.orders o
SET source = t.source,
    source_medium = t.source_medium,
    attribution = coalesce(o.attribution, '{}'::jsonb) || jsonb_build_object(
      'detected_by', 'legacy_same_phone',
      'estimated', true,
      'matched_order', t.order_no,
      'estimated_at', now()
    )
FROM tracked t
WHERE right(regexp_replace(o.phone, '\D', '', 'g'), 10) = t.ph
  AND (o.source IS NULL OR o.attribution->>'detected_by' IN ('legacy_estimate', 'legacy_coupon'));

-- ---------- ধাপ ২: কুপন কোডে প্ল্যাটফর্মের নাম থাকলে ----------
UPDATE public.orders
SET source = CASE
               WHEN coupon_code ~* '(tiktok|^tt)' THEN 'tiktok'
               WHEN coupon_code ~* '(insta|^ig)' THEN 'instagram'
               WHEN coupon_code ~* '(facebook|^fb|meta)' THEN 'facebook'
               WHEN coupon_code ~* '(youtube|^yt)' THEN 'youtube'
               WHEN coupon_code ~* 'google' THEN 'google'
             END,
    source_medium = 'paid',
    attribution = coalesce(attribution, '{}'::jsonb) || jsonb_build_object(
      'detected_by', 'legacy_coupon', 'estimated', true, 'estimated_at', now()
    )
WHERE source IS NULL
  AND coupon_code ~* '(tiktok|^tt|insta|^ig|facebook|^fb|meta|youtube|^yt|google)';

-- ---------- ধাপ ৩: বাকি সব পুরনো অর্ডার → Facebook (আনুমানিক) ----------
-- কোনো নির্দিষ্ট সময়ে TikTok-এ বিজ্ঞাপন চালিয়ে থাকলে, এই ধাপের আগে নিচের
-- উদাহরণের মতো তারিখ দিয়ে সেই সময়ের অর্ডার TikTok করে দিন (-- মুছে চালান):
--
-- UPDATE public.orders
-- SET source = 'tiktok', source_medium = 'paid',
--     attribution = coalesce(attribution, '{}'::jsonb)
--       || jsonb_build_object('detected_by', 'legacy_estimate', 'estimated', true, 'estimated_at', now())
-- WHERE source IS NULL
--   AND created_at >= '2026-10-01' AND created_at < '2026-10-15';

UPDATE public.orders
SET source = 'facebook',
    source_medium = 'paid',
    attribution = coalesce(attribution, '{}'::jsonb) || jsonb_build_object(
      'detected_by', 'legacy_estimate', 'estimated', true, 'estimated_at', now()
    )
WHERE source IS NULL;

-- ---------- ফলাফল ----------
SELECT source,
       coalesce(attribution->>'detected_by', '—') AS how,
       count(*) AS orders,
       sum(total) AS amount
FROM public.orders
GROUP BY 1, 2
ORDER BY 3 DESC;

-- ---------- ভুল হলে ফেরত (শুধু আনুমানিকগুলো আবার "অজানা" হবে) ----------
-- UPDATE public.orders
-- SET source = NULL, source_medium = NULL,
--     attribution = nullif(attribution - 'detected_by' - 'estimated' - 'estimated_at' - 'matched_order', '{}'::jsonb)
-- WHERE attribution->>'detected_by' LIKE 'legacy_%';
