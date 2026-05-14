
CREATE TABLE IF NOT EXISTS public.manpower_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_starting date NOT NULL,
  week_ending date NOT NULL,
  location text NOT NULL CHECK (location IN ('factory','site')),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  is_late boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted')),
  total_planned_mandays numeric DEFAULT 0,
  budgeted_mandays numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location, week_starting, project_id)
);

CREATE TABLE IF NOT EXISTS public.manpower_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.manpower_plans(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.labour_workers(id) ON DELETE CASCADE,
  monday text, tuesday text, wednesday text, thursday text, friday text, saturday text,
  total_days numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, worker_id)
);

CREATE TABLE IF NOT EXISTS public.manpower_subcontractor_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.manpower_plans(id) ON DELETE CASCADE,
  subcontractor_id uuid,
  sub_name text NOT NULL,
  trade text,
  planned_start date,
  planned_end date,
  scope text,
  days_on_site numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manpower_plans_week_loc ON public.manpower_plans(week_starting DESC, location);
CREATE INDEX IF NOT EXISTS idx_mp_entries_plan ON public.manpower_plan_entries(plan_id);
CREATE INDEX IF NOT EXISTS idx_mp_subs_plan ON public.manpower_subcontractor_plan(plan_id);

ALTER TABLE public.manpower_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manpower_plan_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manpower_subcontractor_plan ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_submit_manpower(_user_id uuid, _location text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND (
        role IN ('super_admin','managing_director','planning_head','head_operations')
        OR (_location = 'factory' AND role = 'production_head')
        OR (_location = 'site'    AND role = 'site_installation_mgr')
      )
  )
$$;

CREATE POLICY "manpower_plans_read"  ON public.manpower_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "manpower_plans_write" ON public.manpower_plans FOR ALL    TO authenticated
  USING (public.can_submit_manpower(auth.uid(), location))
  WITH CHECK (public.can_submit_manpower(auth.uid(), location));

CREATE POLICY "mp_entries_read"  ON public.manpower_plan_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_entries_write" ON public.manpower_plan_entries FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM public.manpower_plans p WHERE p.id = plan_id AND public.can_submit_manpower(auth.uid(), p.location)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.manpower_plans p WHERE p.id = plan_id AND public.can_submit_manpower(auth.uid(), p.location)));

CREATE POLICY "mp_subs_read"  ON public.manpower_subcontractor_plan FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_subs_write" ON public.manpower_subcontractor_plan FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM public.manpower_plans p WHERE p.id = plan_id AND public.can_submit_manpower(auth.uid(), p.location)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.manpower_plans p WHERE p.id = plan_id AND public.can_submit_manpower(auth.uid(), p.location)));

CREATE TRIGGER trg_manpower_plans_updated BEFORE UPDATE ON public.manpower_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
