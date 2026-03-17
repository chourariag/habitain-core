-- Create storage bucket for QC photos
INSERT INTO storage.buckets (id, name, public) VALUES ('qc-photos', 'qc-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated can upload qc photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'qc-photos');

CREATE POLICY "Anyone can view qc photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'qc-photos');
