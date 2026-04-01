
-- Add AI photo quality fields to daily_production_logs
ALTER TABLE public.daily_production_logs
  ADD COLUMN IF NOT EXISTS quality_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_issues text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_quality_checked boolean DEFAULT false;

-- Add AI photo quality fields to site_diary
ALTER TABLE public.site_diary
  ADD COLUMN IF NOT EXISTS quality_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_issues text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_quality_checked boolean DEFAULT false;

-- Add AI photo quality fields to rm_tickets
ALTER TABLE public.rm_tickets
  ADD COLUMN IF NOT EXISTS quality_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_issues text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_quality_checked boolean DEFAULT false;

-- Add AI photo quality fields to qc_inspection_items
ALTER TABLE public.qc_inspection_items
  ADD COLUMN IF NOT EXISTS quality_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_issues text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_quality_checked boolean DEFAULT false;
