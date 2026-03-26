ALTER TABLE public.rm_tickets ADD COLUMN IF NOT EXISTS ai_analysis jsonb;
ALTER TABLE public.rm_tickets ADD COLUMN IF NOT EXISTS ai_analysis_generated_at timestamptz;