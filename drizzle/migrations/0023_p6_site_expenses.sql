ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS bill_no text,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS receipt_exif_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS policy_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS warning_reason text;

CREATE INDEX IF NOT EXISTS idx_expense_entries_dup ON public.expense_entries (lower(vendor), lower(bill_no), amount) WHERE vendor IS NOT NULL AND bill_no IS NOT NULL;

CREATE POLICY "expense_receipts_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "expense_receipts_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','hr_executive','finance_manager']::public.app_role[])
    OR (public.get_user_role(auth.uid()) = ANY (ARRAY['production_head','head_operations']::public.app_role[])
        AND EXISTS (SELECT 1 FROM public.expense_entries e WHERE e.receipt_path = storage.objects.name AND e.status = 'pending_hod'))
  )
);

CREATE OR REPLACE FUNCTION public.check_expense_duplicate(p_vendor text, p_bill_no text, p_amount numeric, p_exclude_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(trim(p_vendor),'') <> '' AND coalesce(trim(p_bill_no),'') <> ''
    AND EXISTS (
      SELECT 1 FROM public.expense_entries e
      WHERE lower(trim(e.vendor)) = lower(trim(p_vendor))
        AND lower(trim(e.bill_no)) = lower(trim(p_bill_no))
        AND e.amount = p_amount
        AND (p_exclude_id IS NULL OR e.id <> p_exclude_id)
    );
$$;
REVOKE ALL ON FUNCTION public.check_expense_duplicate(text,text,numeric,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_expense_duplicate(text,text,numeric,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_expense_receipt(p_entry_id uuid, p_path text, p_exif_at timestamptz, p_flags text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT submitted_by INTO v_owner FROM public.expense_entries WHERE id = p_entry_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RAISE EXCEPTION 'You can only attach receipts to your own expenses'; END IF;
  IF split_part(p_path, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'Receipt must be in your own folder'; END IF;
  UPDATE public.expense_entries
     SET receipt_path = p_path,
         receipt_exif_at = p_exif_at,
         receipt_flags = (SELECT coalesce(array_agg(DISTINCT f), '{}') FROM unnest(coalesce(p_flags,'{}'::text[])) f WHERE f IN ('no_exif','from_gallery')),
         updated_at = now()
   WHERE id = p_entry_id;
END $$;
REVOKE ALL ON FUNCTION public.attach_expense_receipt(uuid,text,timestamptz,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_expense_receipt(uuid,text,timestamptz,text[]) TO authenticated;