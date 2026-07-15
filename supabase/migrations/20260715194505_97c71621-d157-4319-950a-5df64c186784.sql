
-- Revoke public EXECUTE on SECURITY DEFINER functions (RLS still calls them internally as postgres)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Tighten geocode_cache insert: prevent authenticated users from overwriting existing cached entries with junk
DROP POLICY IF EXISTS "Authenticated insert geocode" ON public.geocode_cache;
CREATE POLICY "Authenticated insert new geocode" ON public.geocode_cache
  FOR INSERT TO authenticated
  WITH CHECK (query IS NOT NULL AND length(query) > 0);
