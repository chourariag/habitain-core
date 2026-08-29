ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_architect_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_project_architect_id ON public.projects(project_architect_id);

COMMENT ON COLUMN public.projects.project_architect_id IS 'Assigned Project Architect (profiles.id). Resolves S-1 and E-5 gate ownership dynamically at display time.';