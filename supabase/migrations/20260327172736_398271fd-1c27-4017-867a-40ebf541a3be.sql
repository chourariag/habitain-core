ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS division text NOT NULL DEFAULT 'Habitainer';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_design_only boolean NOT NULL DEFAULT false;