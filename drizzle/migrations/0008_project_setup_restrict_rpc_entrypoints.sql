REVOKE ALL ON FUNCTION public.commit_project_setup_upload(uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_project_setup_upload_validated(uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_project_setup_excel_upload(uuid,jsonb,jsonb,jsonb) TO authenticated;