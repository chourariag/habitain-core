ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS module_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS panel_count integer NOT NULL DEFAULT 0;
NOTIFY pgrst, 'reload schema';