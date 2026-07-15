-- access_config
DROP POLICY IF EXISTS "Authenticated read access config" ON public.access_config;
CREATE POLICY "Admins read access config" ON public.access_config
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- global_config
DROP POLICY IF EXISTS "Authenticated read global config" ON public.global_config;
CREATE POLICY "Admins read global config" ON public.global_config
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- bevatel_calls
DROP POLICY IF EXISTS "Authenticated read bevatel calls" ON public.bevatel_calls;
CREATE POLICY "Admins read bevatel calls" ON public.bevatel_calls
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- whatsapp_messages
DROP POLICY IF EXISTS "Authenticated read whatsapp" ON public.whatsapp_messages;
CREATE POLICY "Admins read whatsapp" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- complaints
DROP POLICY IF EXISTS "Authenticated read complaints" ON public.complaints;
CREATE POLICY "Admins assignees or creators read complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- cost_entries
DROP POLICY IF EXISTS "Authenticated read cost entries" ON public.cost_entries;
CREATE POLICY "Admins or managers read cost entries" ON public.cost_entries
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );