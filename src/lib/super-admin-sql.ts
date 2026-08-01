/**
 * One-time SQL the shop owner runs in the Supabase SQL Editor.
 * It installs permanent super-admin support that survives domain changes,
 * without needing a service-role key in the app.
 */
export const PRIMARY_ADMIN_EMAIL = "ahsanfashion07@gmail.com";

export const SUPER_ADMIN_SETUP_SQL = `-- Ahsan Fashion — permanent Super Admin setup (run once)
CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admins readable by admins" ON public.super_admins;
CREATE POLICY "super admins readable by admins" ON public.super_admins
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.primary_admin_email()
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$ SELECT '${PRIMARY_ADMIN_EMAIL}'::text $fn$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.super_admins s WHERE s.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM auth.users u
                 WHERE u.id = _user_id AND lower(u.email) = public.primary_admin_email())
$fn$;

CREATE OR REPLACE FUNCTION public.ensure_primary_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE u record;
BEGIN
  SELECT id, email, email_confirmed_at INTO u
  FROM auth.users WHERE lower(email) = public.primary_admin_email() LIMIT 1;
  IF u.id IS NULL THEN
    RETURN jsonb_build_object('exists', false, 'email', public.primary_admin_email());
  END IF;
  IF u.email_confirmed_at IS NULL THEN
    UPDATE auth.users SET email_confirmed_at = now() WHERE id = u.id;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.super_admins (user_id) VALUES (u.id) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('exists', true, 'email', u.email, 'emailConfirmed', true, 'isAdmin', true);
END; $fn$;
GRANT EXECUTE ON FUNCTION public.ensure_primary_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.primary_admin_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE u record;
BEGIN
  SELECT id, email, email_confirmed_at INTO u
  FROM auth.users WHERE lower(email) = public.primary_admin_email() LIMIT 1;
  IF u.id IS NULL THEN
    RETURN jsonb_build_object('email', public.primary_admin_email(), 'exists', false,
      'emailConfirmed', false, 'isAdmin', false);
  END IF;
  RETURN jsonb_build_object('email', u.email, 'exists', true,
    'emailConfirmed', u.email_confirmed_at IS NOT NULL,
    'isAdmin', public.has_role(u.id, 'admin'));
END; $fn$;
GRANT EXECUTE ON FUNCTION public.primary_admin_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_primary_admin_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF lower(NEW.email) = public.primary_admin_email() THEN
    IF NEW.email_confirmed_at IS NULL THEN
      UPDATE auth.users SET email_confirmed_at = now() WHERE id = NEW.id;
    END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.super_admins (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS primary_admin_bootstrap ON auth.users;
CREATE TRIGGER primary_admin_bootstrap
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_primary_admin_user();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid, email text, email_confirmed boolean, created_at timestamptz,
  last_sign_in_at timestamptz, roles text[], is_super boolean, is_permanent boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.email_confirmed_at IS NOT NULL, u.created_at, u.last_sign_in_at,
         COALESCE(ARRAY(SELECT r.role::text FROM public.user_roles r WHERE r.user_id = u.id), '{}'),
         public.is_super_admin(u.id),
         lower(u.email) = public.primary_admin_email()
  FROM auth.users u ORDER BY u.created_at DESC;
END; $fn$;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_email text, _assignment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE target uuid; norm text := lower(trim(_email));
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden: super admin only'; END IF;
  IF _assignment NOT IN ('super_admin','admin','staff','none') THEN
    RAISE EXCEPTION 'Invalid role assignment';
  END IF;
  IF norm = public.primary_admin_email() AND _assignment <> 'super_admin' THEN
    RAISE EXCEPTION 'Permanent owner account cannot lose super admin';
  END IF;
  SELECT id INTO target FROM auth.users WHERE lower(email) = norm LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'No account exists for %', norm; END IF;

  DELETE FROM public.super_admins WHERE user_id = target;
  IF _assignment = 'super_admin' THEN
    INSERT INTO public.super_admins (user_id) VALUES (target) ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (target, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _assignment = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (target, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    DELETE FROM public.user_roles WHERE user_id = target AND role = 'staff';
  ELSIF _assignment = 'staff' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (target, 'staff')
      ON CONFLICT (user_id, role) DO NOTHING;
    DELETE FROM public.user_roles WHERE user_id = target AND role = 'admin';
  ELSE
    DELETE FROM public.user_roles WHERE user_id = target AND role IN ('admin','staff');
  END IF;
  RETURN jsonb_build_object('email', norm, 'assignment', _assignment);
END; $fn$;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, text) TO authenticated;

SELECT public.ensure_primary_admin();
`;
