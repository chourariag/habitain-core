-- Extend labour_claims with SLA fields
ALTER TABLE public.labour_claims
  ADD COLUMN IF NOT EXISTS worker_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS labour_worker_id UUID REFERENCES public.labour_workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS process_stage TEXT,
  ADD COLUMN IF NOT EXISTS hours NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_hours NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- Make legacy NOT-NULL columns nullable for new SLA-style entries
ALTER TABLE public.labour_claims ALTER COLUMN module_id DROP NOT NULL;
ALTER TABLE public.labour_claims ALTER COLUMN worker_id DROP NOT NULL;
ALTER TABLE public.labour_claims ALTER COLUMN trade DROP NOT NULL;
ALTER TABLE public.labour_claims ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE public.labour_claims ALTER COLUMN quantity SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_labour_claims_status ON public.labour_claims(status);
CREATE INDEX IF NOT EXISTS idx_labour_claims_submitted_at ON public.labour_claims(submitted_at DESC);

CREATE OR REPLACE FUNCTION public.can_approve_labour_claims(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','production_head','head_operations')
  )
$$;

-- ============ QUALITY FLAGS ============
CREATE TABLE IF NOT EXISTS public.quality_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bay_number INTEGER,
  bay_label TEXT,
  module_id UUID REFERENCES public.modules(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  flagged_by UUID NOT NULL,
  observation TEXT NOT NULL CHECK (char_length(observation) <= 150),
  severity TEXT NOT NULL CHECK (severity IN ('minor','review','stop_work')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','converted_to_ncr','dismissed','resolved')),
  tagore_action TEXT,
  tagore_note TEXT,
  ncr_id UUID,
  actioned_by UUID,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quality_flags_status ON public.quality_flags(status);
CREATE INDEX IF NOT EXISTS idx_quality_flags_created ON public.quality_flags(created_at DESC);
ALTER TABLE public.quality_flags ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_action_quality_flag(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','qc_inspector','production_head','head_operations')
  )
$$;

DROP POLICY IF EXISTS "view quality flags" ON public.quality_flags;
DROP POLICY IF EXISTS "raise quality flag" ON public.quality_flags;
DROP POLICY IF EXISTS "action quality flag" ON public.quality_flags;
CREATE POLICY "view quality flags" ON public.quality_flags FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "raise quality flag" ON public.quality_flags FOR INSERT WITH CHECK (auth.uid() = flagged_by);
CREATE POLICY "action quality flag" ON public.quality_flags FOR UPDATE
  USING (public.can_action_quality_flag(auth.uid()))
  WITH CHECK (public.can_action_quality_flag(auth.uid()));

DROP TRIGGER IF EXISTS trg_quality_flags_updated ON public.quality_flags;
CREATE TRIGGER trg_quality_flags_updated BEFORE UPDATE ON public.quality_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SAFETY INCIDENTS ============
CREATE TABLE IF NOT EXISTS public.safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT NOT NULL,
  location_detail TEXT,
  persons_involved UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  reported_by UUID NOT NULL,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('near_miss','first_aid','medical_treatment','dangerous_occurrence','property_damage')),
  severity TEXT NOT NULL CHECK (severity IN ('minor','moderate','serious','critical')),
  description TEXT NOT NULL CHECK (char_length(description) >= 50),
  immediate_action TEXT NOT NULL,
  work_stopped BOOLEAN NOT NULL DEFAULT false,
  photo_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  root_cause TEXT,
  root_cause_at TIMESTAMPTZ,
  corrective_action TEXT,
  corrective_action_at TIMESTAMPTZ,
  preventive_measure TEXT,
  preventive_measure_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','action_pending','closed')),
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_at ON public.safety_incidents(incident_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_status ON public.safety_incidents(status);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_persons ON public.safety_incidents USING GIN (persons_involved);
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_safety(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director',
                   'head_operations','production_head','site_installation_mgr','hr_executive')
  )
$$;

DROP POLICY IF EXISTS "anyone view safety" ON public.safety_incidents;
DROP POLICY IF EXISTS "anyone report safety" ON public.safety_incidents;
DROP POLICY IF EXISTS "manage safety updates" ON public.safety_incidents;
CREATE POLICY "anyone view safety" ON public.safety_incidents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "anyone report safety" ON public.safety_incidents FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "manage safety updates" ON public.safety_incidents FOR UPDATE
  USING (public.can_manage_safety(auth.uid()))
  WITH CHECK (public.can_manage_safety(auth.uid()));

DROP TRIGGER IF EXISTS trg_safety_incidents_updated ON public.safety_incidents;
CREATE TRIGGER trg_safety_incidents_updated BEFORE UPDATE ON public.safety_incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for safety photos
INSERT INTO storage.buckets (id, name, public) VALUES ('safety-photos', 'safety-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Safety photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload safety photos" ON storage.objects;
CREATE POLICY "Safety photos are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'safety-photos');
CREATE POLICY "Authenticated can upload safety photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'safety-photos' AND auth.uid() IS NOT NULL);