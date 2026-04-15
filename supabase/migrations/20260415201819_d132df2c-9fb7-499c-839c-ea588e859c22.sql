
-- Create project_tasks table
CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id_in_schedule TEXT NOT NULL,
  task_name TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'Pre-Production',
  planned_start_date DATE,
  planned_finish_date DATE,
  actual_start_date DATE,
  actual_finish_date DATE,
  duration_days INTEGER DEFAULT 0,
  predecessor_ids TEXT[] DEFAULT '{}',
  responsible_role TEXT,
  status TEXT NOT NULL DEFAULT 'Upcoming',
  completion_percentage INTEGER NOT NULL DEFAULT 0,
  delay_days INTEGER DEFAULT 0,
  remarks TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  lock_override_by UUID,
  lock_override_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project tasks"
  ON public.project_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert project tasks"
  ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update project tasks"
  ON public.project_tasks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete project tasks"
  ON public.project_tasks FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_phase ON public.project_tasks(phase);
CREATE INDEX idx_project_tasks_status ON public.project_tasks(status);

-- Create project_task_schedule_uploads table
CREATE TABLE public.project_task_schedule_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  task_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.project_task_schedule_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view schedule uploads"
  ON public.project_task_schedule_uploads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedule uploads"
  ON public.project_task_schedule_uploads FOR INSERT TO authenticated WITH CHECK (true);
