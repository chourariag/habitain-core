CREATE OR REPLACE FUNCTION public.get_preprod_gate_flags(_project_id uuid)
RETURNS TABLE (scope_signed boolean, sale_uploaded boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT s.status = 'signed'
      FROM public.project_scope_of_work s
      WHERE s.project_id = _project_id
      ORDER BY s.created_at DESC
      LIMIT 1
    ), false) AS scope_signed,
    EXISTS (
      SELECT 1 FROM public.contracts_register c
      WHERE c.project_id = _project_id
        AND c.contract_type = 'Sale Agreement'
        AND COALESCE(c.is_archived, false) = false
        AND c.contract_file_url IS NOT NULL
    ) AS sale_uploaded;
$$;

REVOKE ALL ON FUNCTION public.get_preprod_gate_flags(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_preprod_gate_flags(uuid) TO authenticated;