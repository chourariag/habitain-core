
-- Restrict public-readable storage SELECT policies to authenticated users only
DROP POLICY IF EXISTS "Public can read design-files" ON storage.objects;
CREATE POLICY "Authenticated can read design-files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'design-files');

DROP POLICY IF EXISTS "Public can view drawings" ON storage.objects;
CREATE POLICY "Authenticated can view drawings" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'drawings');

DROP POLICY IF EXISTS "Public can view dry-run-videos" ON storage.objects;
CREATE POLICY "Authenticated can view dry-run-videos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'dry-run-videos');

DROP POLICY IF EXISTS "Public can view voice-notes" ON storage.objects;
CREATE POLICY "Authenticated can view voice-notes" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'voice-notes');

DROP POLICY IF EXISTS "Safety photos are publicly readable" ON storage.objects;
CREATE POLICY "Authenticated can read safety-photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'safety-photos');

DROP POLICY IF EXISTS "floor_plans_read_public" ON storage.objects;
CREATE POLICY "floor_plans_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'floor-plans');
