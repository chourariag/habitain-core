-- Add velocity columns to module_schedule
ALTER TABLE public.module_schedule
  ADD COLUMN IF NOT EXISTS planned_duration_days integer,
  ADD COLUMN IF NOT EXISTS actual_duration_days integer,
  ADD COLUMN IF NOT EXISTS velocity_ratio numeric;

-- Velocity alerts table
CREATE TABLE public.velocity_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  module_id text NOT NULL,
  stage_number integer NOT NULL,
  planned_completion date,
  forecast_completion date,
  days_behind integer NOT NULL DEFAULT 0,
  coaching_message text,
  sunday_recommended boolean NOT NULL DEFAULT false,
  sunday_approved boolean,
  sunday_approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.velocity_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "velocity_alerts_read" ON public.velocity_alerts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'planning_engineer') OR
    public.has_role(auth.uid(), 'qc_inspector') OR
    public.has_role(auth.uid(), 'head_operations') OR
    public.has_role(auth.uid(), 'site_installation_mgr') OR
    public.is_director(auth.uid())
  );

CREATE POLICY "velocity_alerts_write" ON public.velocity_alerts
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'planning_engineer') OR
    public.is_director(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'planning_engineer') OR
    public.is_director(auth.uid())
  );

CREATE TRIGGER update_velocity_alerts_updated_at
  BEFORE UPDATE ON public.velocity_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();