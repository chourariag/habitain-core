
CREATE OR REPLACE FUNCTION public.get_storage_usage_by_bucket()
RETURNS TABLE(bucket_id text, file_count bigint, total_bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT
    o.bucket_id,
    count(*)::bigint AS file_count,
    COALESCE(sum((o.metadata->>'size')::bigint), 0)::bigint AS total_bytes
  FROM storage.objects o
  WHERE public.has_role(auth.uid(), 'super_admin')
     OR public.has_role(auth.uid(), 'managing_director')
     OR public.has_role(auth.uid(), 'head_of_projects')
  GROUP BY o.bucket_id
  ORDER BY total_bytes DESC;
$$;

REVOKE ALL ON FUNCTION public.get_storage_usage_by_bucket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_storage_usage_by_bucket() TO authenticated;
