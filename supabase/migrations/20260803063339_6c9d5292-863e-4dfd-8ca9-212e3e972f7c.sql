CREATE POLICY "Sales roles upload sale agreements"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'design-files'
  AND name LIKE 'sale-agreements/%'
  AND public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','sales_executive','sales_associate','planning_head']::app_role[])
);

CREATE POLICY "Sales roles read sale agreements"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'design-files'
  AND name LIKE 'sale-agreements/%'
  AND public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','sales_executive','sales_associate','planning_head','head_of_projects']::app_role[])
);

CREATE POLICY "Sales roles update sale agreements"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'design-files'
  AND name LIKE 'sale-agreements/%'
  AND public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','sales_director','sales_executive','sales_associate']::app_role[])
);