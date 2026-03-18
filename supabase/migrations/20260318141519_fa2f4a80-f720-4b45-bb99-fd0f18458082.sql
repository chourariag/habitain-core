
ALTER TABLE public.site_readiness
  ADD COLUMN IF NOT EXISTS dry_run_video_url text,
  ADD COLUMN IF NOT EXISTS labour_stay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS labour_stay_notes text,
  ADD COLUMN IF NOT EXISTS labour_food boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS labour_food_notes text,
  ADD COLUMN IF NOT EXISTS dg_generator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dg_generator_notes text,
  ADD COLUMN IF NOT EXISTS nearest_hardware_shop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_name text,
  ADD COLUMN IF NOT EXISTS shop_address text,
  ADD COLUMN IF NOT EXISTS shop_phone text,
  ADD COLUMN IF NOT EXISTS supervisor_stay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supervisor_stay_notes text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('dry-run-videos', 'dry-run-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload dry-run-videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dry-run-videos');

CREATE POLICY "Public can view dry-run-videos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dry-run-videos');
