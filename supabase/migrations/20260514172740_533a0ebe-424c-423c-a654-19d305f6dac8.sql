
ALTER TABLE public.dispatch_packs
  ADD COLUMN IF NOT EXISTS module_id text,
  ADD COLUMN IF NOT EXISTS pieces_count integer,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.dispatch_packs ALTER COLUMN status SET DEFAULT 'draft';
