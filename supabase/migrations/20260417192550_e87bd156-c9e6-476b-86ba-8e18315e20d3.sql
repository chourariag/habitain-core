CREATE TABLE public.panel_handovers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_batch_id UUID NOT NULL REFERENCES public.panel_batches(id) ON DELETE CASCADE,
  source_panel_bay INTEGER NOT NULL,
  target_module_bay INTEGER NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  related_task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ready_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ,
  received_by UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_panel_handovers_status ON public.panel_handovers(status);
CREATE INDEX idx_panel_handovers_target_bay ON public.panel_handovers(target_module_bay);
CREATE INDEX idx_panel_handovers_project ON public.panel_handovers(project_id);

ALTER TABLE public.panel_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view panel handovers"
  ON public.panel_handovers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Production roles can insert panel handovers"
  ON public.panel_handovers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'production_head'::app_role)
    OR public.has_role(auth.uid(), 'factory_floor_supervisor'::app_role)
    OR public.is_full_admin(auth.uid())
  );

CREATE POLICY "Production roles can update panel handovers"
  ON public.panel_handovers FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head'::app_role)
    OR public.has_role(auth.uid(), 'factory_floor_supervisor'::app_role)
    OR public.is_full_admin(auth.uid())
  );

CREATE TRIGGER trg_panel_handovers_updated
  BEFORE UPDATE ON public.panel_handovers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();