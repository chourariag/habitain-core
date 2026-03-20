
-- Add columns to attendance_records
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS offline_captured boolean DEFAULT false;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- Add site GPS columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_lat numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_lng numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_radius integer DEFAULT 300;

-- Pre-seed factory GPS settings if not exist
INSERT INTO public.app_settings (key, value) VALUES ('factory_lat', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('factory_lng', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('factory_radius', '200') ON CONFLICT (key) DO NOTHING;
