
-- 1. Create gfc_records table
CREATE TABLE public.gfc_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  gfc_stage text NOT NULL CHECK (gfc_stage IN ('advance_h1', 'final_h2')),
  module_group text[] DEFAULT '{}',
  issued_by uuid,
  issued_at timestamptz DEFAULT now(),
  pdf_url text,
  sections_complete integer DEFAULT 0,
  sections_total integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_gfc_records_project_stage ON public.gfc_records(project_id, gfc_stage);

ALTER TABLE public.gfc_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view GFC records"
ON public.gfc_records FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Principal architects and directors can issue GFC"
ON public.gfc_records FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'principal_architect') OR
  public.is_director(auth.uid())
);

CREATE POLICY "Principal architects and directors can update GFC"
ON public.gfc_records FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'principal_architect') OR
  public.is_director(auth.uid())
);

CREATE TRIGGER update_gfc_records_updated_at
BEFORE UPDATE ON public.gfc_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add columns to drawings table
ALTER TABLE public.drawings
  ADD COLUMN IF NOT EXISTS file_format text DEFAULT 'pdf',
  ADD COLUMN IF NOT EXISTS category_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS revision_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 3. Add columns to design_queries table
ALTER TABLE public.design_queries
  ADD COLUMN IF NOT EXISTS dq_category text,
  ADD COLUMN IF NOT EXISTS resolution_timeline date,
  ADD COLUMN IF NOT EXISTS resolution_reminder_sent boolean DEFAULT false;
