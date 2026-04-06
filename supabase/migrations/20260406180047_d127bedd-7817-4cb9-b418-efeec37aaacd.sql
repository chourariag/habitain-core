
-- Add WIP tracking columns to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS wip_start_date timestamptz,
ADD COLUMN IF NOT EXISTS wip_close_date timestamptz,
ADD COLUMN IF NOT EXISTS wip_status text NOT NULL DEFAULT 'not_started';
