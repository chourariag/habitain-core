
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS storage_cleaned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storage_cleaned_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_cleaned_by uuid;

CREATE TABLE IF NOT EXISTS public.project_storage_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'storage_cleanup',
  performed_by uuid,
  performed_by_role text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  files_deleted_count integer NOT NULL DEFAULT 0,
  buckets_processed jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.project_storage_cleanup_log TO authenticated;
GRANT ALL ON public.project_storage_cleanup_log TO service_role;

ALTER TABLE public.project_storage_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cleanup_log_select_leadership" ON public.project_storage_cleanup_log
  FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid())::text = ANY (ARRAY[
      'managing_director','super_admin','head_of_projects'
    ])
  );

CREATE POLICY "cleanup_log_service_insert" ON public.project_storage_cleanup_log
  FOR INSERT TO service_role WITH CHECK (true);
