
-- Add weather, manpower, blockers to site_diary
ALTER TABLE public.site_diary ADD COLUMN IF NOT EXISTS weather_condition text;
ALTER TABLE public.site_diary ADD COLUMN IF NOT EXISTS manpower_count integer;
ALTER TABLE public.site_diary ADD COLUMN IF NOT EXISTS blockers text;

-- Add handover_notes to handover_pack
ALTER TABLE public.handover_pack ADD COLUMN IF NOT EXISTS handover_notes text;
