-- Fix 5: GFC 18-point QC checklist (Karan/Venkat sign-off gate)
CREATE TABLE IF NOT EXISTS public.gfc_qc_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_number int NOT NULL CHECK (item_number BETWEEN 1 AND 18),
  item_label text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  note text,
  checked_by uuid,
  checked_by_name text,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, item_number)
);

ALTER TABLE public.gfc_qc_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Architects and leadership view GFC QC"
  ON public.gfc_qc_checklist FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid() AND p.is_active = true
      AND p.role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director',
                     'principal_architect','project_architect','structural_architect','head_operations',
                     'planning_engineer','planning_head','head_of_projects','production_head')
  ));

CREATE POLICY "Architects manage GFC QC"
  ON public.gfc_qc_checklist FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid() AND p.is_active = true
      AND p.role IN ('super_admin','managing_director','principal_architect','project_architect','structural_architect','head_operations','architecture_director')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid() AND p.is_active = true
      AND p.role IN ('super_admin','managing_director','principal_architect','project_architect','structural_architect','head_operations','architecture_director')
  ));

CREATE TRIGGER trg_gfc_qc_checklist_updated_at
  BEFORE UPDATE ON public.gfc_qc_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fix 1: Design stage history (audit trail of stage transitions)
CREATE TABLE IF NOT EXISTS public.design_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage text NOT NULL,                       -- brief | concept | schematic | design_dev | gfc | h1_issued | h2_issued | as_builts
  reached_at timestamptz NOT NULL DEFAULT now(),
  reached_by uuid,
  reached_by_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_stage_history_project ON public.design_stage_history(project_id, reached_at DESC);

ALTER TABLE public.design_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authed view design stage history"
  ON public.design_stage_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Architects insert design stage history"
  ON public.design_stage_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid() AND p.is_active = true
      AND p.role IN ('super_admin','managing_director','principal_architect','project_architect','structural_architect','head_operations','architecture_director','planning_head','planning_engineer')
  ));