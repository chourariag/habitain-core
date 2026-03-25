
-- Create design_qc_checklist table
CREATE TABLE public.design_qc_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  section_number integer NOT NULL,
  section_name text NOT NULL,
  item_index integer NOT NULL,
  item_text text NOT NULL,
  is_ticked boolean NOT NULL DEFAULT false,
  ticked_by uuid,
  ticked_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, section_number, item_index)
);

-- Create design_detail_library table
CREATE TABLE public.design_detail_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  detail_number integer NOT NULL,
  detail_name text NOT NULL,
  status text NOT NULL DEFAULT 'Not Started',
  drawing_reference text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, detail_number)
);

-- Indexes
CREATE INDEX idx_design_qc_checklist_project ON public.design_qc_checklist (project_id);
CREATE INDEX idx_design_detail_library_project ON public.design_detail_library (project_id);

-- RLS on design_qc_checklist
ALTER TABLE public.design_qc_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Architects and directors can view design_qc_checklist"
  ON public.design_qc_checklist FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect', 'structural_architect',
      'super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director'
    )
  );

CREATE POLICY "Architects can update design_qc_checklist"
  ON public.design_qc_checklist FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect',
      'super_admin', 'managing_director'
    )
  );

CREATE POLICY "Architects can insert design_qc_checklist"
  ON public.design_qc_checklist FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect',
      'super_admin', 'managing_director'
    )
  );

-- RLS on design_detail_library
ALTER TABLE public.design_detail_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Architects and directors can view design_detail_library"
  ON public.design_detail_library FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect', 'structural_architect',
      'super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director'
    )
  );

CREATE POLICY "Architects can update design_detail_library"
  ON public.design_detail_library FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect',
      'super_admin', 'managing_director'
    )
  );

CREATE POLICY "Architects can insert design_detail_library"
  ON public.design_detail_library FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect',
      'super_admin', 'managing_director'
    )
  );
