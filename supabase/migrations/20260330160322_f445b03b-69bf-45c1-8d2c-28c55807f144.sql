
-- Add file_url and uploaded_by_name columns to design_detail_library
ALTER TABLE public.design_detail_library
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS uploaded_by_name text;

-- Create section signoffs table for QC checklist
CREATE TABLE IF NOT EXISTS public.design_qc_section_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  section_number integer NOT NULL,
  signed_by uuid NOT NULL,
  signed_by_name text,
  signed_by_role text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, section_number)
);

ALTER TABLE public.design_qc_section_signoffs ENABLE ROW LEVEL SECURITY;

-- RLS: architects can insert/read, directors can read
CREATE POLICY "architects_insert_section_signoffs"
  ON public.design_qc_section_signoffs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'principal_architect') OR
    public.has_role(auth.uid(), 'project_architect') OR
    public.is_full_admin(auth.uid())
  );

CREATE POLICY "architects_select_section_signoffs"
  ON public.design_qc_section_signoffs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'principal_architect') OR
    public.has_role(auth.uid(), 'project_architect') OR
    public.has_role(auth.uid(), 'structural_architect') OR
    public.is_director(auth.uid())
  );
