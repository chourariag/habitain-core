
CREATE TABLE public.material_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_plan_item_id UUID REFERENCES public.project_material_plan_items(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL DEFAULT 'overdue_delivery',
  priority TEXT NOT NULL DEFAULT 'high',
  message TEXT NOT NULL,
  material_name TEXT,
  related_task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  vendor_name TEXT,
  days_overdue INTEGER,
  days_remaining INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view material alerts"
  ON public.material_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create material alerts"
  ON public.material_alerts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update material alerts"
  ON public.material_alerts FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_material_alerts_project ON public.material_alerts(project_id);
CREATE INDEX idx_material_alerts_status ON public.material_alerts(status);

CREATE TRIGGER update_material_alerts_updated_at
  BEFORE UPDATE ON public.material_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
