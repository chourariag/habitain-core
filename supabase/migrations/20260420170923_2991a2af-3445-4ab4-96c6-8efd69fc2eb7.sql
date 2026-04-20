-- Add production_system to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS production_system TEXT NOT NULL DEFAULT 'modular';

-- Add check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_production_system_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_production_system_check
      CHECK (production_system IN ('modular', 'panelised', 'hybrid'));
  END IF;
END $$;

-- Backfill: existing Panel-based projects → panelised; everything else → modular (already default)
UPDATE public.projects
  SET production_system = 'panelised'
  WHERE construction_type = 'Panel-based' AND production_system = 'modular';

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_projects_production_system
  ON public.projects(production_system);