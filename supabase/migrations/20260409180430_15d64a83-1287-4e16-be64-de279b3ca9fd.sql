-- Add lead time columns to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS expected_delivery_date date,
  ADD COLUMN IF NOT EXISTS actual_delivery_date date,
  ADD COLUMN IF NOT EXISTS lead_time_promised integer,
  ADD COLUMN IF NOT EXISTS lead_time_actual integer,
  ADD COLUMN IF NOT EXISTS lead_time_variance integer;

-- Schedule conflicts table
CREATE TABLE public.schedule_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  stage_name text NOT NULL,
  days_behind integer NOT NULL DEFAULT 0,
  planned_end date,
  forecast_end date,
  conflict_status text NOT NULL DEFAULT 'active',
  sunday_work_status text DEFAULT 'none',
  sunday_work_date date,
  sunday_work_approved_by uuid,
  sunday_work_approved_at timestamptz,
  sunday_work_rejected_reason text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_conflicts_read" ON public.schedule_conflicts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'planning_engineer') OR
    public.has_role(auth.uid(), 'qc_inspector') OR
    public.has_role(auth.uid(), 'head_operations') OR
    public.is_director(auth.uid())
  );

CREATE POLICY "schedule_conflicts_write" ON public.schedule_conflicts
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

CREATE TRIGGER update_schedule_conflicts_updated_at
  BEFORE UPDATE ON public.schedule_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vendor lead time summary table
CREATE TABLE public.vendor_lead_time_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL UNIQUE,
  total_pos integer NOT NULL DEFAULT 0,
  avg_promised_days numeric DEFAULT 0,
  avg_actual_days numeric DEFAULT 0,
  avg_delay_days numeric DEFAULT 0,
  on_time_pct numeric DEFAULT 0,
  reliability_rating text DEFAULT 'Fair',
  last_delivery_date date,
  last_updated timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_lead_time_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_summary_read" ON public.vendor_lead_time_summary
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'procurement') OR
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'planning_engineer') OR
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'head_operations') OR
    public.is_director(auth.uid())
  );

CREATE POLICY "vendor_summary_write" ON public.vendor_lead_time_summary
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'procurement') OR
    public.has_role(auth.uid(), 'production_head') OR
    public.is_director(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'procurement') OR
    public.has_role(auth.uid(), 'production_head') OR
    public.is_director(auth.uid())
  );