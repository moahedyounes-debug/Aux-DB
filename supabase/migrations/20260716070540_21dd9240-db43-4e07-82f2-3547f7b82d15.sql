
-- 1) cost_entries: scope managers to their own branch
DROP POLICY IF EXISTS "Admins or managers read cost entries" ON public.cost_entries;
CREATE POLICY "Admins or managers read cost entries"
ON public.cost_entries
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND (
      -- All-access managers see all branches
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_all_access = true)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.branch IS NOT NULL
          AND cost_entries.branch IS NOT NULL
          AND p.branch = cost_entries.branch
      )
    )
  )
);

DROP POLICY IF EXISTS "Managers insert cost entries" ON public.cost_entries;
CREATE POLICY "Managers insert cost entries"
ON public.cost_entries
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_all_access = true)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.branch IS NOT NULL
          AND cost_entries.branch IS NOT NULL
          AND p.branch = cost_entries.branch
      )
    )
  )
);

-- 2) geocode_cache: restrict reads to admins and managers (still authenticated, no longer wide-open)
DROP POLICY IF EXISTS "Authenticated read geocode" ON public.geocode_cache;
CREATE POLICY "Admins and managers read geocode"
ON public.geocode_cache
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'manager'::app_role)
);

DROP POLICY IF EXISTS "Authenticated insert new geocode" ON public.geocode_cache;
CREATE POLICY "Admins and managers insert geocode"
ON public.geocode_cache
FOR INSERT
TO authenticated
WITH CHECK (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'manager'::app_role))
  AND query IS NOT NULL
  AND length(query) > 0
);

-- 3) whatsapp_messages: replace catch-all admin ALL with explicit per-command policies
-- so INSERT/UPDATE/DELETE authorization is unambiguous. Ingestion by webhooks uses
-- the service_role key, which bypasses RLS.
DROP POLICY IF EXISTS "Admins manage whatsapp" ON public.whatsapp_messages;

CREATE POLICY "Admins insert whatsapp"
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update whatsapp"
ON public.whatsapp_messages
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins delete whatsapp"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
