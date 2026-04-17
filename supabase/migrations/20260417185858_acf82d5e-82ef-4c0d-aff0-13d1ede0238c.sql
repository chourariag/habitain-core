CREATE TABLE public.capacity_forecast_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  panel_bay_cycle_days numeric NOT NULL DEFAULT 14,
  module_bay_stage_days numeric NOT NULL DEFAULT 5,
  active_days_per_week integer NOT NULL DEFAULT 6,
  target_modules_per_month integer NOT NULL DEFAULT 20,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.capacity_forecast_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read forecast settings"
  ON public.capacity_forecast_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Directors and ops can write forecast settings"
  ON public.capacity_forecast_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'managing_director')
    OR public.has_role(auth.uid(),'finance_director') OR public.has_role(auth.uid(),'sales_director')
    OR public.has_role(auth.uid(),'architecture_director') OR public.has_role(auth.uid(),'head_operations')
    OR public.has_role(auth.uid(),'production_head'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'managing_director')
    OR public.has_role(auth.uid(),'finance_director') OR public.has_role(auth.uid(),'sales_director')
    OR public.has_role(auth.uid(),'architecture_director') OR public.has_role(auth.uid(),'head_operations')
    OR public.has_role(auth.uid(),'production_head'));

INSERT INTO public.capacity_forecast_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;