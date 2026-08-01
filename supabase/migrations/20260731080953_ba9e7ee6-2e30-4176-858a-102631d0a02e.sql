
DROP POLICY "orders public insert" ON public.orders;
DROP POLICY "order items public insert" ON public.order_items;
DROP POLICY "history public insert" ON public.order_status_history;
REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.order_items FROM anon;
REVOKE INSERT ON public.order_status_history FROM anon;
CREATE POLICY "orders admin insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "order items admin insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "history admin insert" ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (public.is_admin());
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
