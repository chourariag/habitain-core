ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text
  GENERATED ALWAYS AS (CASE WHEN lower(coalesce(division, '')) = 'ads' THEN 'ads' ELSE 'habitainer' END) STORED;

CREATE INDEX IF NOT EXISTS idx_projects_project_type ON public.projects(project_type);