ALTER TABLE public.project_scope_of_work
  ADD COLUMN IF NOT EXISTS external_signature_platform text,
  ADD COLUMN IF NOT EXISTS external_document_id text,
  ADD COLUMN IF NOT EXISTS external_execution_date date,
  ADD COLUMN IF NOT EXISTS external_signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS externally_signed_by uuid,
  ADD COLUMN IF NOT EXISTS externally_signed_at timestamptz;

ALTER TABLE public.contracts_register
  ADD COLUMN IF NOT EXISTS external_signature_platform text,
  ADD COLUMN IF NOT EXISTS external_document_id text,
  ADD COLUMN IF NOT EXISTS external_execution_date date,
  ADD COLUMN IF NOT EXISTS is_combined_scope_agreement boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.submit_external_combined_contract(
  p_project_id uuid,
  p_scope_id uuid,
  p_platform text,
  p_document_id text,
  p_execution_date date,
  p_file_path text,
  p_vendor_name text,
  p_contract_value numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_contract_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_any_role(v_uid, ARRAY['super_admin','managing_director','chairman','sales_director']::app_role[]) THEN
    RAISE EXCEPTION 'Only the Sales Director and above can record an externally-signed combined contract' USING ERRCODE = '42501';
  END IF;

  IF p_document_id IS NULL OR btrim(p_document_id) = '' THEN
    RAISE EXCEPTION 'The e-signature platform Document ID is mandatory';
  END IF;
  IF p_platform IS NULL OR btrim(p_platform) = '' THEN
    RAISE EXCEPTION 'The e-signature platform name is mandatory';
  END IF;
  IF p_execution_date IS NULL THEN
    RAISE EXCEPTION 'The execution date is mandatory';
  END IF;
  IF p_file_path IS NULL OR btrim(p_file_path) = '' THEN
    RAISE EXCEPTION 'The signed PDF is mandatory';
  END IF;

  UPDATE public.project_scope_of_work
     SET status = 'signed',
         locked = true,
         external_signature_platform = btrim(p_platform),
         external_document_id = btrim(p_document_id),
         external_execution_date = p_execution_date,
         external_signed_pdf_url = p_file_path,
         externally_signed_by = v_uid,
         externally_signed_at = now(),
         client_signed_at = COALESCE(client_signed_at, p_execution_date::timestamptz),
         client_signed_by = COALESCE(client_signed_by, p_vendor_name),
         sales_director_signed_by = COALESCE(sales_director_signed_by, v_uid),
         sales_director_signed_at = COALESCE(sales_director_signed_at, now()),
         updated_at = now()
   WHERE id = p_scope_id AND project_id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scope of Work not found for this project';
  END IF;

  SELECT id INTO v_contract_id
    FROM public.contracts_register
   WHERE project_id = p_project_id
     AND contract_type = 'Sale Agreement'
     AND is_archived = false
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_contract_id IS NULL THEN
    INSERT INTO public.contracts_register (
      project_id, vendor_name, scope_of_work, contract_type, contract_value_excl_gst,
      start_date, status, scope_of_work_id, contract_file_url, created_by,
      external_signature_platform, external_document_id, external_execution_date,
      is_combined_scope_agreement
    ) VALUES (
      p_project_id, COALESCE(NULLIF(btrim(p_vendor_name), ''), 'Client'),
      'Combined Scope of Work + Sale Agreement (externally executed)',
      'Sale Agreement', COALESCE(p_contract_value, 0),
      p_execution_date, 'Active', p_scope_id, p_file_path, v_uid,
      btrim(p_platform), btrim(p_document_id), p_execution_date, true
    )
    RETURNING id INTO v_contract_id;
  ELSE
    UPDATE public.contracts_register
       SET contract_file_url = p_file_path,
           scope_of_work_id = p_scope_id,
           scope_of_work = 'Combined Scope of Work + Sale Agreement (externally executed)',
           contract_value_excl_gst = COALESCE(NULLIF(p_contract_value, 0), contract_value_excl_gst),
           start_date = p_execution_date,
           external_signature_platform = btrim(p_platform),
           external_document_id = btrim(p_document_id),
           external_execution_date = p_execution_date,
           is_combined_scope_agreement = true,
           unlocked_until = NULL,
           updated_at = now()
     WHERE id = v_contract_id;
  END IF;

  RETURN v_contract_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_external_combined_contract(uuid,uuid,text,text,date,text,text,numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_external_combined_contract(uuid,uuid,text,text,date,text,text,numeric) TO authenticated;