
-- =====================================================
-- Running Bill System: BOQ + Daily Measurements
-- =====================================================

-- 1) BOQ items
CREATE TABLE public.boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_code text,
  description text NOT NULL,
  unit text NOT NULL,
  boq_qty numeric(14,3) NOT NULL DEFAULT 0,
  boq_rate numeric(14,2) NOT NULL DEFAULT 0,
  stage text,
  trade text NOT NULL DEFAULT 'general' CHECK (trade IN ('general','electrical','plumbing','structural','finishing')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_boq_items_project ON public.boq_items(project_id) WHERE is_archived = false;
CREATE INDEX idx_boq_items_stage ON public.boq_items(project_id, stage) WHERE is_archived = false;

-- 2) Daily measurements (header)
CREATE TABLE public.daily_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  stage text,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  location text NOT NULL CHECK (location IN ('factory','site')),
  trade text NOT NULL DEFAULT 'general' CHECK (trade IN ('general','electrical','plumbing','structural','finishing')),
  team_label text,
  notes text,
  is_locked boolean NOT NULL DEFAULT true,
  unlock_reason text,
  unlocked_by uuid,
  unlocked_at timestamptz,
  anomaly_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_by uuid NOT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dm_project_date ON public.daily_measurements(project_id, measurement_date) WHERE is_archived = false;
CREATE INDEX idx_dm_module_date ON public.daily_measurements(module_id, measurement_date) WHERE is_archived = false;
CREATE INDEX idx_dm_submitter_date ON public.daily_measurements(submitted_by, measurement_date) WHERE is_archived = false;
CREATE INDEX idx_dm_location_date ON public.daily_measurements(location, measurement_date) WHERE is_archived = false;

-- 3) Measurement line items
CREATE TABLE public.measurement_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.daily_measurements(id) ON DELETE CASCADE,
  boq_item_id uuid NOT NULL REFERENCES public.boq_items(id) ON DELETE RESTRICT,
  today_qty numeric(14,3) NOT NULL DEFAULT 0,
  cumulative_qty_snapshot numeric(14,3) NOT NULL DEFAULT 0,
  value_today_snapshot numeric(14,2) NOT NULL DEFAULT 0,
  pct_complete_snapshot numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mli_measurement ON public.measurement_line_items(measurement_id);
CREATE INDEX idx_mli_boq ON public.measurement_line_items(boq_item_id);

-- Update trigger for updated_at
CREATE TRIGGER trg_boq_items_updated BEFORE UPDATE ON public.boq_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dm_updated BEFORE UPDATE ON public.daily_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Helper functions
-- =====================================================

-- Who can manage BOQ (Karthik / Suraj / MD / super_admin / planning_head)
CREATE OR REPLACE FUNCTION public.can_manage_boq(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','head_operations','planning_head','planning_engineer','costing_engineer')
  )
$$;

-- Who can read BOQ / measurements (broad read for project participants)
CREATE OR REPLACE FUNCTION public.can_read_measurements(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
  )
$$;

-- Who can submit factory measurement
CREATE OR REPLACE FUNCTION public.can_submit_factory_measurement(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','factory_floor_supervisor','production_head','head_operations','electrical_installer','elec_plumbing_installer')
  )
$$;

-- Who can submit site measurement
CREATE OR REPLACE FUNCTION public.can_submit_site_measurement(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','site_engineer','site_installation_mgr','head_operations')
  )
$$;

-- Who can unlock a measurement (Azad / Awaiz / MD)
CREATE OR REPLACE FUNCTION public.can_unlock_measurement(_user_id uuid, _location text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND (
        role IN ('super_admin','managing_director','head_operations')
        OR (_location = 'factory' AND role IN ('production_head','head_operations'))
        OR (_location = 'site' AND role IN ('site_installation_mgr','head_operations'))
      )
  )
$$;

-- Running bill aggregator
CREATE OR REPLACE FUNCTION public.recalc_running_bill(_project_id uuid)
RETURNS TABLE (
  boq_item_id uuid,
  description text,
  unit text,
  stage text,
  trade text,
  boq_qty numeric,
  boq_rate numeric,
  boq_value numeric,
  qty_done_factory numeric,
  qty_done_site numeric,
  total_qty_done numeric,
  pct_complete numeric,
  value_earned numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    b.id AS boq_item_id,
    b.description,
    b.unit,
    b.stage,
    b.trade,
    b.boq_qty,
    b.boq_rate,
    (b.boq_qty * b.boq_rate)::numeric AS boq_value,
    COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.location = 'factory' AND dm.is_archived = false), 0)::numeric AS qty_done_factory,
    COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.location = 'site' AND dm.is_archived = false), 0)::numeric AS qty_done_site,
    COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.is_archived = false), 0)::numeric AS total_qty_done,
    CASE WHEN b.boq_qty > 0
      THEN LEAST(100, ROUND((COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.is_archived = false), 0) / b.boq_qty) * 100, 2))
      ELSE 0
    END::numeric AS pct_complete,
    (COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.is_archived = false), 0) * b.boq_rate)::numeric AS value_earned
  FROM public.boq_items b
  LEFT JOIN public.measurement_line_items mli ON mli.boq_item_id = b.id
  LEFT JOIN public.daily_measurements dm ON dm.id = mli.measurement_id
  WHERE b.project_id = _project_id AND b.is_archived = false
  GROUP BY b.id, b.description, b.unit, b.stage, b.trade, b.boq_qty, b.boq_rate
  ORDER BY b.stage, b.description;
$$;

-- Cumulative qty for a BOQ item up to (but excluding) a given measurement_id.
-- Used by the client to compute "Previously Recorded".
CREATE OR REPLACE FUNCTION public.boq_cumulative_qty(_boq_item_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(mli.today_qty), 0)::numeric
  FROM public.measurement_line_items mli
  JOIN public.daily_measurements dm ON dm.id = mli.measurement_id
  WHERE mli.boq_item_id = _boq_item_id AND dm.is_archived = false
$$;

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.boq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_line_items ENABLE ROW LEVEL SECURITY;

-- BOQ
CREATE POLICY "boq_read_all_authenticated" ON public.boq_items
  FOR SELECT TO authenticated USING (public.can_read_measurements(auth.uid()));
CREATE POLICY "boq_insert_managers" ON public.boq_items
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_boq(auth.uid()));
CREATE POLICY "boq_update_managers" ON public.boq_items
  FOR UPDATE TO authenticated USING (public.can_manage_boq(auth.uid()))
  WITH CHECK (public.can_manage_boq(auth.uid()));
CREATE POLICY "boq_delete_md" ON public.boq_items
  FOR DELETE TO authenticated USING (public.is_md(auth.uid()));

-- Daily measurements
CREATE POLICY "dm_read_all" ON public.daily_measurements
  FOR SELECT TO authenticated USING (public.can_read_measurements(auth.uid()));
CREATE POLICY "dm_insert_factory" ON public.daily_measurements
  FOR INSERT TO authenticated WITH CHECK (
    submitted_by = auth.uid() AND (
      (location = 'factory' AND public.can_submit_factory_measurement(auth.uid()))
      OR (location = 'site' AND public.can_submit_site_measurement(auth.uid()))
    )
  );
CREATE POLICY "dm_update_when_unlocked_or_unlocker" ON public.daily_measurements
  FOR UPDATE TO authenticated USING (
    public.is_md(auth.uid())
    OR public.can_unlock_measurement(auth.uid(), location)
    OR (submitted_by = auth.uid() AND is_locked = false)
  ) WITH CHECK (
    public.is_md(auth.uid())
    OR public.can_unlock_measurement(auth.uid(), location)
    OR (submitted_by = auth.uid() AND is_locked = false)
  );
CREATE POLICY "dm_no_delete" ON public.daily_measurements
  FOR DELETE TO authenticated USING (public.is_md(auth.uid()));

-- Measurement line items inherit from header
CREATE POLICY "mli_read_all" ON public.measurement_line_items
  FOR SELECT TO authenticated USING (public.can_read_measurements(auth.uid()));
CREATE POLICY "mli_insert_with_header" ON public.measurement_line_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_measurements dm
      WHERE dm.id = measurement_id AND dm.submitted_by = auth.uid()
    )
  );
CREATE POLICY "mli_update_when_header_unlocked" ON public.measurement_line_items
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.daily_measurements dm
      WHERE dm.id = measurement_id AND dm.is_locked = false
        AND (dm.submitted_by = auth.uid() OR public.is_md(auth.uid()))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_measurements dm
      WHERE dm.id = measurement_id AND dm.is_locked = false
        AND (dm.submitted_by = auth.uid() OR public.is_md(auth.uid()))
    )
  );
CREATE POLICY "mli_delete_md" ON public.measurement_line_items
  FOR DELETE TO authenticated USING (public.is_md(auth.uid()));
