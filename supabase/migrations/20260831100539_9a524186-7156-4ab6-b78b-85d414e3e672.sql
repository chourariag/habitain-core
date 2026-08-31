DROP POLICY IF EXISTS "Architects can update project_design_files" ON public.project_design_files;
DROP POLICY IF EXISTS "Architects can insert project_design_files" ON public.project_design_files;

CREATE POLICY "Architects can update project_design_files"
ON public.project_design_files FOR UPDATE TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['principal_architect','project_architect','senior_architect','super_admin','managing_director','sales_director','architecture_director']::app_role[]))
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['principal_architect','project_architect','senior_architect','super_admin','managing_director','sales_director','architecture_director']::app_role[]));

CREATE POLICY "Architects can insert project_design_files"
ON public.project_design_files FOR INSERT TO authenticated
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['principal_architect','project_architect','senior_architect','super_admin','managing_director','sales_director','architecture_director']::app_role[]));

-- Keep is_design_only in sync between projects and project_design_files
CREATE OR REPLACE FUNCTION public.sync_design_only_from_design_file()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_design_only IS DISTINCT FROM COALESCE((SELECT is_design_only FROM public.projects WHERE id = NEW.project_id), NEW.is_design_only) THEN
    UPDATE public.projects SET is_design_only = NEW.is_design_only WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_design_only_to_design_file()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_design_only IS DISTINCT FROM OLD.is_design_only THEN
    UPDATE public.project_design_files SET is_design_only = NEW.is_design_only
    WHERE project_id = NEW.id AND is_design_only IS DISTINCT FROM NEW.is_design_only;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_design_only_from_design_file ON public.project_design_files;
CREATE TRIGGER trg_sync_design_only_from_design_file
AFTER INSERT OR UPDATE OF is_design_only ON public.project_design_files
FOR EACH ROW EXECUTE FUNCTION public.sync_design_only_from_design_file();

DROP TRIGGER IF EXISTS trg_sync_design_only_to_design_file ON public.projects;
CREATE TRIGGER trg_sync_design_only_to_design_file
AFTER UPDATE OF is_design_only ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.sync_design_only_to_design_file();
