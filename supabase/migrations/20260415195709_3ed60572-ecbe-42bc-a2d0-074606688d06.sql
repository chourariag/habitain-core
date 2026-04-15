
CREATE TABLE public.project_boq (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  uploaded_by UUID NULL,
  uploaded_by_name TEXT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_boq_value NUMERIC NOT NULL DEFAULT 0,
  blended_margin_pct NUMERIC NOT NULL DEFAULT 0,
  factory_scope_value NUMERIC NOT NULL DEFAULT 0,
  civil_scope_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_boq_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  boq_id UUID NOT NULL REFERENCES public.project_boq(id) ON DELETE CASCADE,
  sno INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  item_description TEXT NOT NULL DEFAULT '',
  unit TEXT NULL,
  actual_qty NUMERIC NOT NULL DEFAULT 0,
  wastage_pct NUMERIC NOT NULL DEFAULT 0,
  boq_qty NUMERIC NOT NULL DEFAULT 0,
  material_rate NUMERIC NOT NULL DEFAULT 0,
  labour_rate NUMERIC NOT NULL DEFAULT 0,
  oh_rate NUMERIC NOT NULL DEFAULT 0,
  boq_rate NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  margin_pct NUMERIC NULL,
  scope TEXT NOT NULL DEFAULT 'Factory',
  procured_qty NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_boq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_boq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view BOQ"
  ON public.project_boq FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized roles can insert BOQ"
  ON public.project_boq FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN (
      'super_admin','managing_director','finance_director','finance_manager',
      'planning_engineer','architecture_director','project_architect','principal_architect'
    )
  );

CREATE POLICY "Authorized roles can update BOQ"
  ON public.project_boq FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN (
      'super_admin','managing_director','finance_director','finance_manager',
      'planning_engineer','architecture_director','project_architect','principal_architect'
    )
  );

CREATE POLICY "Only MD can delete BOQ"
  ON public.project_boq FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('super_admin','managing_director'));

CREATE POLICY "Authenticated users can view BOQ items"
  ON public.project_boq_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized roles can insert BOQ items"
  ON public.project_boq_items FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN (
      'super_admin','managing_director','finance_director','finance_manager',
      'planning_engineer','architecture_director','project_architect','principal_architect'
    )
  );

CREATE POLICY "Authorized roles can update BOQ items"
  ON public.project_boq_items FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN (
      'super_admin','managing_director','finance_director','finance_manager',
      'planning_engineer','architecture_director','project_architect','principal_architect'
    )
  );

CREATE POLICY "Only MD can delete BOQ items"
  ON public.project_boq_items FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('super_admin','managing_director'));

CREATE TRIGGER update_boq_updated_at
  BEFORE UPDATE ON public.project_boq
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_boq_project ON public.project_boq(project_id);
CREATE INDEX idx_boq_items_boq ON public.project_boq_items(boq_id);
