
-- Add columns to design_stages for GFC evidence tracking
ALTER TABLE public.design_stages ADD COLUMN IF NOT EXISTS evidence_url text;
ALTER TABLE public.design_stages ADD COLUMN IF NOT EXISTS evidence_uploaded_at timestamptz;
ALTER TABLE public.design_stages ADD COLUMN IF NOT EXISTS ticked_by uuid;
ALTER TABLE public.design_stages ADD COLUMN IF NOT EXISTS ticked_at timestamptz;

-- Add columns to project_design_files for target GFC and design-only flag
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS target_gfc_date date;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS is_design_only boolean NOT NULL DEFAULT true;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS linked_project_id uuid;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS gfc_issued_at timestamptz;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS gfc_issued_by uuid;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS gfc_issuer_name text;

-- Add columns to drawings for approval workflow
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS drawing_title text;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_review';
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_method text;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_date date;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_reference text;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_screenshot_url text;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approved_by_name text;
