
-- Add regression columns to ncr_register
ALTER TABLE public.ncr_register
  ADD COLUMN IF NOT EXISTS requires_regression boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regression_from_stage integer,
  ADD COLUMN IF NOT EXISTS regression_to_stage integer,
  ADD COLUMN IF NOT EXISTS regression_reason text,
  ADD COLUMN IF NOT EXISTS regression_start_date date,
  ADD COLUMN IF NOT EXISTS regression_end_date date,
  ADD COLUMN IF NOT EXISTS total_rework_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rework_cost numeric NOT NULL DEFAULT 0;

-- Create rework_log_entries table
CREATE TABLE public.rework_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_id uuid NOT NULL REFERENCES public.ncr_register(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  worker_name text NOT NULL,
  skill_type text NOT NULL,
  hours_worked numeric NOT NULL,
  daily_rate_used numeric NOT NULL DEFAULT 0,
  rework_cost numeric NOT NULL DEFAULT 0,
  task_description text,
  logged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rework_log_entries ENABLE ROW LEVEL SECURITY;

-- Production head, QC inspector, factory supervisor: full access
CREATE POLICY "Production roles full access on rework_log"
  ON public.rework_log_entries FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'qc_inspector')
    OR public.has_role(auth.uid(), 'factory_floor_supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'qc_inspector')
    OR public.has_role(auth.uid(), 'factory_floor_supervisor')
  );

-- Directors, MD, ops, planning: read only
CREATE POLICY "Management read rework_log"
  ON public.rework_log_entries FOR SELECT TO authenticated
  USING (
    public.is_full_admin(auth.uid())
    OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'planning_engineer')
  );

CREATE TRIGGER update_rework_log_entries_updated_at
  BEFORE UPDATE ON public.rework_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
