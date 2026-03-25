
-- KPI Definitions table
CREATE TABLE public.kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  kpi_name text NOT NULL,
  kpi_key text NOT NULL UNIQUE,
  target_value numeric,
  unit text NOT NULL DEFAULT '%',
  measurement_period text NOT NULL DEFAULT 'weekly',
  data_source_table text,
  data_source_query text,
  coaching_template_below text,
  coaching_template_above text,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read kpi_definitions" ON public.kpi_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Directors can insert kpi_definitions" ON public.kpi_definitions
  FOR INSERT TO authenticated WITH CHECK (is_director(auth.uid()));

CREATE POLICY "Directors can update kpi_definitions" ON public.kpi_definitions
  FOR UPDATE TO authenticated USING (is_director(auth.uid()));

-- KPI Snapshots table
CREATE TABLE public.kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  kpi_key text NOT NULL,
  target_value numeric,
  actual_value numeric,
  score integer DEFAULT 0,
  status text NOT NULL DEFAULT 'no_data',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User sees own kpi_snapshots" ON public.kpi_snapshots
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_director(auth.uid())
    OR is_full_admin(auth.uid())
    OR (
      get_user_role(auth.uid()) IN ('production_head', 'head_operations', 'finance_manager', 'sales_director', 'architecture_director')
    )
  );

CREATE POLICY "System can insert kpi_snapshots" ON public.kpi_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);

-- Weekly Digests table
CREATE TABLE public.weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  overall_score integer DEFAULT 0,
  wins jsonb DEFAULT '[]'::jsonb,
  focus_areas jsonb DEFAULT '[]'::jsonb,
  digest_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User sees own weekly_digests" ON public.weekly_digests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_director(auth.uid()));

CREATE POLICY "System can insert weekly_digests" ON public.weekly_digests
  FOR INSERT TO authenticated WITH CHECK (true);

-- KPI Targets History table
CREATE TABLE public.kpi_targets_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_key text NOT NULL,
  role app_role NOT NULL,
  old_target numeric,
  new_target numeric,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

ALTER TABLE public.kpi_targets_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors can view kpi_targets_history" ON public.kpi_targets_history
  FOR SELECT TO authenticated USING (is_director(auth.uid()));

CREATE POLICY "Directors can insert kpi_targets_history" ON public.kpi_targets_history
  FOR INSERT TO authenticated WITH CHECK (is_director(auth.uid()));
