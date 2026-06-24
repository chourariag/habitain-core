
-- Allow all authenticated users to read app_settings (needed for GPS config at check-in)
DROP POLICY IF EXISTS "Admins can view app settings" ON public.app_settings;
CREATE POLICY "Authenticated can view app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

-- Seed/update location settings
INSERT INTO public.app_settings (key, value) VALUES
  ('factory_lat', '13.2696634'),
  ('factory_lng', '77.5744424'),
  ('factory_radius', '500'),
  ('factory_gps_enabled', 'false'),
  ('office_lat', ''),
  ('office_lng', ''),
  ('office_radius', '200'),
  ('office_gps_enabled', 'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE app_settings.key IN ('factory_lat','factory_lng','factory_radius','factory_gps_enabled');

-- For office_* only insert if missing
INSERT INTO public.app_settings (key, value)
SELECT k, v FROM (VALUES
  ('office_lat',''),('office_lng',''),('office_radius','200'),('office_gps_enabled','false')
) AS t(k,v)
ON CONFLICT (key) DO NOTHING;
