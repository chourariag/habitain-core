
CREATE TABLE public.daily_labour_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  location_type text NOT NULL CHECK (location_type IN ('factory_bay','site')),
  bay_number integer,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  stage text NOT NULL,
  trade_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cost numeric NOT NULL DEFAULT 0,
  notes text,
  submitted_by uuid REFERENCES auth.users(id),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_labour_logs_date ON public.daily_labour_logs (log_date DESC);
CREATE INDEX idx_daily_labour_logs_project ON public.daily_labour_logs (project_id);
CREATE INDEX idx_daily_labour_logs_location ON public.daily_labour_logs (location_type, bay_number);

ALTER TABLE public.daily_labour_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View daily labour logs"
  ON public.daily_labour_logs FOR SELECT
  USING (public.can_access_labour_register(auth.uid()));

CREATE POLICY "Insert daily labour logs"
  ON public.daily_labour_logs FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid() AND is_active = true
        AND role IN ('super_admin','managing_director','head_operations',
                     'production_head','factory_floor_supervisor','fabrication_foreman',
                     'site_installation_mgr','site_engineer')
    )
  );

CREATE POLICY "Update daily labour logs"
  ON public.daily_labour_logs FOR UPDATE
  USING (public.can_manage_labour_register(auth.uid()))
  WITH CHECK (public.can_manage_labour_register(auth.uid()));

CREATE TRIGGER trg_daily_labour_logs_updated
  BEFORE UPDATE ON public.daily_labour_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
