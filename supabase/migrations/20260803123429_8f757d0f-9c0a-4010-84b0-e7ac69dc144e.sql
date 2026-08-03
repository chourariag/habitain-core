DROP POLICY IF EXISTS "Sales roles read sale agreements" ON storage.objects;
CREATE POLICY "Authenticated read sale agreements"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'design-files' AND name LIKE 'sale-agreements/%');