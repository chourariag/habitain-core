
-- Create rm-media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('rm-media', 'rm-media', true);

-- Allow authenticated users to upload to rm-media
CREATE POLICY "Authenticated users can upload rm-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rm-media');

-- Allow authenticated users to read rm-media
CREATE POLICY "Authenticated users can read rm-media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rm-media');
