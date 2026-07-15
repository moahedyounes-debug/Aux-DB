
-- ============================================================
-- 1. ROLES ENUM + user_roles table (secure separate table)
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  )
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- 2. PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  branch TEXT,
  company TEXT,
  is_all_access BOOLEAN NOT NULL DEFAULT false,
  language TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. ACCESS CONFIG (email allow-list per company/branch)
-- ============================================================
CREATE TABLE public.access_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  branch TEXT,
  is_all_access BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.access_config TO authenticated;
GRANT ALL ON public.access_config TO service_role;
ALTER TABLE public.access_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read access config" ON public.access_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage access config" ON public.access_config
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER access_config_updated_at BEFORE UPDATE ON public.access_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. DASHBOARD CONFIG (per-user per-page: targets, formulas, layout)
-- ============================================================
CREATE TABLE public.dashboard_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_config TO authenticated;
GRANT ALL ON public.dashboard_config TO service_role;
ALTER TABLE public.dashboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dashboard config" ON public.dashboard_config
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER dashboard_config_updated_at BEFORE UPDATE ON public.dashboard_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Global config (admin-only) — targets, formulas shared across users
CREATE TABLE public.global_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.global_config TO authenticated;
GRANT ALL ON public.global_config TO service_role;
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read global config" ON public.global_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage global config" ON public.global_config
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 5. ACTIVITY LOG
-- ============================================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own activity" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own activity" ON public.activity_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all activity" ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX idx_activity_log_user_created ON public.activity_log (user_id, created_at DESC);
CREATE INDEX idx_activity_log_created ON public.activity_log (created_at DESC);

-- ============================================================
-- 6. COST ENTRIES
-- ============================================================
CREATE TABLE public.cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  branch TEXT,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_entries TO authenticated;
GRANT ALL ON public.cost_entries TO service_role;
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read cost entries" ON public.cost_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert cost entries" ON public.cost_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.is_admin(auth.uid()));
CREATE POLICY "Admins update cost entries" ON public.cost_entries
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete cost entries" ON public.cost_entries
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER cost_entries_updated_at BEFORE UPDATE ON public.cost_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. COMPLAINTS (e-commerce complaints workflow)
-- ============================================================
CREATE TYPE public.complaint_status AS ENUM ('new', 'in_progress', 'awaiting_customer', 'resolved', 'closed', 'rejected');

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  channel TEXT,
  category TEXT,
  subject TEXT NOT NULL,
  description TEXT,
  status public.complaint_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id),
  branch TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read complaints" ON public.complaints
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert complaints" ON public.complaints
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Assignee or admin update complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (assigned_to = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins delete complaints" ON public.complaints
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER complaints_updated_at BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_complaints_status ON public.complaints (status, created_at DESC);

-- ============================================================
-- 8. WHATSAPP
-- ============================================================
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id TEXT UNIQUE,
  wa_phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'received',
  ticket_id TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read whatsapp" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage whatsapp" ON public.whatsapp_messages
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_whatsapp_phone_created ON public.whatsapp_messages (wa_phone, created_at DESC);

CREATE TABLE public.whatsapp_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_send BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT ON public.whatsapp_access TO authenticated;
GRANT ALL ON public.whatsapp_access TO service_role;
ALTER TABLE public.whatsapp_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own whatsapp access" ON public.whatsapp_access
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage whatsapp access" ON public.whatsapp_access
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 9. BEVATEL CALL CACHE
-- ============================================================
CREATE TABLE public.bevatel_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL,
  caller_number TEXT,
  agent TEXT,
  direction TEXT,
  duration_seconds INT,
  status TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  ticket_id TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bevatel_calls TO authenticated;
GRANT ALL ON public.bevatel_calls TO service_role;
ALTER TABLE public.bevatel_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read bevatel calls" ON public.bevatel_calls
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage bevatel calls" ON public.bevatel_calls
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_bevatel_started ON public.bevatel_calls (started_at DESC);

-- ============================================================
-- 10. GEOCODE CACHE (districts map)
-- ============================================================
CREATE TABLE public.geocode_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT UNIQUE NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  city TEXT,
  district TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.geocode_cache TO authenticated;
GRANT ALL ON public.geocode_cache TO service_role;
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read geocode" ON public.geocode_cache
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert geocode" ON public.geocode_cache
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 11. INTEGRATION KEYS (metadata only — actual secrets in env)
-- ============================================================
CREATE TABLE public.integration_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_keys TO authenticated;
GRANT ALL ON public.integration_keys TO service_role;
ALTER TABLE public.integration_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read integration keys" ON public.integration_keys
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage integration keys" ON public.integration_keys
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER integration_keys_updated_at BEFORE UPDATE ON public.integration_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
