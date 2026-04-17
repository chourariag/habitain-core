-- Panel batches table for tracking panel production in panel bays
CREATE TABLE public.panel_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bay_assignment_id UUID REFERENCES public.bay_assignments(id) ON DELETE CASCADE,
  bay_number INTEGER NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  panel_type TEXT NOT NULL DEFAULT 'wall_panel',
  total_panels INTEGER NOT NULL DEFAULT 0,
  completed_panels INTEGER NOT NULL DEFAULT 0,
  current_stage TEXT NOT NULL DEFAULT 'cutting',
  status TEXT NOT NULL DEFAULT 'in_progress',
  target_module_bay INTEGER,
  expected_completion DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_panel_batches_bay ON public.panel_batches(bay_number);
CREATE INDEX idx_panel_batches_project ON public.panel_batches(project_id);
CREATE INDEX idx_panel_batches_status ON public.panel_batches(status);

ALTER TABLE public.panel_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view panel batches"
  ON public.panel_batches FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Production roles can insert panel batches"
  ON public.panel_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'production_head'::app_role)
    OR public.has_role(auth.uid(), 'factory_floor_supervisor'::app_role)
    OR public.is_full_admin(auth.uid())
  );

CREATE POLICY "Production roles can update panel batches"
  ON public.panel_batches FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head'::app_role)
    OR public.has_role(auth.uid(), 'factory_floor_supervisor'::app_role)
    OR public.is_full_admin(auth.uid())
  );

CREATE POLICY "Production roles can delete panel batches"
  ON public.panel_batches FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head'::app_role)
    OR public.is_full_admin(auth.uid())
  );

CREATE TRIGGER trg_panel_batches_updated
  BEFORE UPDATE ON public.panel_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();