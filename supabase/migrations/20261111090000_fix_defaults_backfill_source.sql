-- =====================================================================
-- ভাঙা default ঠিক করা: অর্ডার লিস্টে Payment-এ "'cod'::text · 'unpaid'::text"
-- দেখাচ্ছিল। কারণ: ডাটাবেস কপি/মাইগ্রেট করার সময় কিছু column-এর default
-- দুইবার quote হয়ে গেছে — default 'cod' না হয়ে লেখা হয়ে গেছে "'cod'::text"।
-- ফলে অর্ডারে payment না পাঠালেই ওই অদ্ভুত লেখাটাই সেভ হতো।
--
-- এই SQL:
--   ১. public schema-র সব টেবিলে এমন ভাঙা default খুঁজে ঠিক করে
--   ২. ভুলভাবে সেভ হওয়া মানগুলো ("'cod'::text" → "cod") ঠিক করে
--
-- Supabase Dashboard → SQL Editor-এ পুরোটা paste করে Run করুন।
-- বারবার চালালেও ক্ষতি নেই।
-- =====================================================================

DO $$
DECLARE
  r record;
  inner_expr text;
  clean_val text;
  n bigint;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name, column_default, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default LIKE '''''%'          -- দুইবার quote দিয়ে শুরু
  LOOP
    EXECUTE format('SELECT (%s)::text', r.column_default) INTO inner_expr;  -- যেমন: 'cod'::text
    IF inner_expr IS NULL OR inner_expr !~ '^''.*''(::[a-z ]+)?$' THEN
      CONTINUE;  -- আসলে ভাঙা নয় (যেমন ফাঁকা default ''), বাদ
    END IF;
    EXECUTE format('SELECT (%s)::text', inner_expr) INTO clean_val;          -- যেমন: cod

    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s',
                   r.table_schema, r.table_name, r.column_name, inner_expr);

    IF r.data_type IN ('text', 'character varying') THEN
      EXECUTE format('UPDATE %I.%I SET %I = %L WHERE %I = %L',
                     r.table_schema, r.table_name, r.column_name, clean_val,
                     r.column_name, inner_expr);
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSE
      n := 0;
    END IF;
    RAISE NOTICE 'ঠিক করা হলো %.%: default % → %, % টি সারি', r.table_name, r.column_name,
      r.column_default, inner_expr, n;
  END LOOP;
END $$;

-- orders-এর জন্য নিশ্চিত হতে আলাদা করে (default যেমনই থাকুক)
ALTER TABLE public.orders ALTER COLUMN payment_method SET DEFAULT 'cod';
ALTER TABLE public.orders ALTER COLUMN payment_status SET DEFAULT 'unpaid';
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.orders
SET payment_method = regexp_replace(payment_method, '^''(.*)''::[a-z ]+$', '\1')
WHERE payment_method ~ '^''.*''::[a-z ]+$';

UPDATE public.orders
SET payment_status = regexp_replace(payment_status, '^''(.*)''::[a-z ]+$', '\1')
WHERE payment_status ~ '^''.*''::[a-z ]+$';

UPDATE public.orders
SET status = regexp_replace(status, '^''(.*)''::[a-z ]+$', '\1')
WHERE status ~ '^''.*''::[a-z ]+$';

UPDATE public.order_status_history
SET status = regexp_replace(status, '^''(.*)''::[a-z ]+$', '\1')
WHERE status ~ '^''.*''::[a-z ]+$';

-- ফলাফল দেখুন — এখানে আর কোনো '...'::text থাকা উচিত না
SELECT payment_method, payment_status, count(*) AS orders
FROM public.orders
GROUP BY 1, 2
ORDER BY 3 DESC;
