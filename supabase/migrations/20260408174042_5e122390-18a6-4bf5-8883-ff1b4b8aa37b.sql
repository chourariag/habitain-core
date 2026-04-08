
-- Weekly manpower plans table
CREATE TABLE public.weekly_manpower_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('factory', 'site')),
  project_id uuid REFERENCES public.projects(id),
  module_id text,
  worker_id uuid REFERENCES public.profiles(id),
  day_of_week text NOT NULL CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday')),
  stage_task text,
  planned_hours numeric DEFAULT 8,
  status text DEFAULT 'planned' CHECK (status IN ('planned','confirmed','adjusted')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.weekly_manpower_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full admin access on manpower plans"
  ON public.weekly_manpower_plans FOR ALL
  TO authenticated
  USING (public.is_full_admin(auth.uid()))
  WITH CHECK (public.is_full_admin(auth.uid()));

CREATE POLICY "Production head and site mgr can manage plans"
  ON public.weekly_manpower_plans FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'site_installation_mgr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'site_installation_mgr')
  );

CREATE TRIGGER update_weekly_manpower_plans_updated_at
  BEFORE UPDATE ON public.weekly_manpower_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily actuals table
CREATE TABLE public.daily_actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  module_id text,
  worker_id uuid REFERENCES public.profiles(id),
  skill_type text,
  hours_worked numeric,
  stage_task text,
  pct_stage_completed integer DEFAULT 0,
  logged_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.daily_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full admin access on daily actuals"
  ON public.daily_actuals FOR ALL
  TO authenticated
  USING (public.is_full_admin(auth.uid()))
  WITH CHECK (public.is_full_admin(auth.uid()));

CREATE POLICY "Production roles can manage actuals"
  ON public.daily_actuals FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'site_installation_mgr') OR
    public.has_role(auth.uid(), 'factory_floor_supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'site_installation_mgr') OR
    public.has_role(auth.uid(), 'factory_floor_supervisor')
  );

CREATE TRIGGER update_daily_actuals_updated_at
  BEFORE UPDATE ON public.daily_actuals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
