-- =========================================================
-- BUCKET (idempotent)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- =========================================================
-- ADMIN WRITE POLICIES
-- =========================================================
DROP POLICY IF EXISTS "admin upload product images" ON storage.objects;
CREATE POLICY "admin upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "admin update product images" ON storage.objects;
CREATE POLICY "admin update product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "admin delete product images" ON storage.objects;
CREATE POLICY "admin delete product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- =========================================================
-- PUBLIC READ  (⚠️ এটাই আসল fix — নিচের ব্যাখ্যা পড়ুন)
-- =========================================================
DROP POLICY IF EXISTS "admin read product images" ON storage.objects;
DROP POLICY IF EXISTS "public read product images" ON storage.objects;
CREATE POLICY "public read product images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');