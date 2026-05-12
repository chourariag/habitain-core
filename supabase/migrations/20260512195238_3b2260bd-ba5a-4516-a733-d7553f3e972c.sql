
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS setup_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS setup_uploaded_by_name text;
