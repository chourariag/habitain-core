-- Add ai_analysis column to rm_tickets for storing AI-generated analysis reports
ALTER TABLE public.rm_tickets
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;
