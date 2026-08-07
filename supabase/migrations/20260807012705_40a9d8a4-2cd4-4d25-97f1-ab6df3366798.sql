REVOKE ALL ON FUNCTION public.can_edit_with_reason(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_with_reason(uuid, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.apply_record_edit(text, uuid, jsonb, text, text) FROM anon;