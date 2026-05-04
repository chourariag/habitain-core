-- Audit log for lock overrides (e.g. Panel Bay → Module Bay handover bypass)
CREATE TABLE IF NOT EXISTS public.task_lock_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID,
  module_id UUID,
  task_id UUID,
  override_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  user_id UUID,
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_lock_overrides_project ON public.task_lock_overrides(project_id);
CREATE INDEX IF NOT EXISTS idx_task_lock_overrides_module ON public.task_lock_overrides(module_id);

ALTER TABLE public.task_lock_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated who can view work orders/production can read overrides
CREATE POLICY "Authenticated users can view lock overrides"
ON public.task_lock_overrides FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can insert their own override entry
CREATE POLICY "Authenticated users can log lock overrides"
ON public.task_lock_overrides FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
