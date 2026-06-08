CREATE TABLE IF NOT EXISTS public.project_progress_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_stage text NOT NULL,
  planned_pct numeric,
  actual_pct numeric,
  variance_pct numeric,
  milestone_status text,
  delay_days integer,
  rag text CHECK (rag IN ('green','amber','red','blue')),
  planned_date date,
  actual_date date,
  forecast_date date,
  units integer,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ppm_project ON public.project_progress_matrix(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_progress_matrix TO authenticated;
GRANT ALL ON public.project_progress_matrix TO service_role;
ALTER TABLE public.project_progress_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ppm" ON public.project_progress_matrix FOR SELECT TO authenticated USING (true);
CREATE POLICY "mgmt write ppm" ON public.project_progress_matrix FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = auth.uid() AND is_active = true
    AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','planning_head')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = auth.uid() AND is_active = true
    AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','planning_head')));
CREATE TRIGGER ppm_updated_at BEFORE UPDATE ON public.project_progress_matrix FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();