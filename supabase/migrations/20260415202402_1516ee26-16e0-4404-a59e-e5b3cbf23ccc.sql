
-- Add delay tracking and parent reference to project_tasks
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS delay_cause TEXT,
  ADD COLUMN IF NOT EXISTS delay_resolution TEXT,
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE;

-- Create subtasks table
CREATE TABLE public.project_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subtasks"
  ON public.project_subtasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert subtasks"
  ON public.project_subtasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update subtasks"
  ON public.project_subtasks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete subtasks"
  ON public.project_subtasks FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_project_subtasks_task_id ON public.project_subtasks(task_id);

CREATE TRIGGER update_project_subtasks_updated_at
  BEFORE UPDATE ON public.project_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
