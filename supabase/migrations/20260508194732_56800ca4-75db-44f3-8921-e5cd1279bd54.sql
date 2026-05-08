ALTER TABLE public.production_task_templates
  ADD COLUMN IF NOT EXISTS stage_name text,
  ADD COLUMN IF NOT EXISTS responsible_role text,
  ADD COLUMN IF NOT EXISTS escalation_role text,
  ADD COLUMN IF NOT EXISTS is_payment_milestone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parallel_stage text,
  ADD COLUMN IF NOT EXISTS special_note text,
  ADD COLUMN IF NOT EXISTS applies_to_systems text[] DEFAULT ARRAY['modular','panelised','hybrid'];

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS stage_name text,
  ADD COLUMN IF NOT EXISTS escalation_role text,
  ADD COLUMN IF NOT EXISTS is_payment_milestone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS qc_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS qc_request_notified_user uuid,
  ADD COLUMN IF NOT EXISTS special_note text;

CREATE TABLE IF NOT EXISTS public.project_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  stage_number int NOT NULL,
  stage_name text NOT NULL,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  status text NOT NULL DEFAULT 'Upcoming',
  is_na boolean NOT NULL DEFAULT false,
  qc_requested_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_project_stages_project ON public.project_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_module ON public.project_stages(module_id);

ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read project_stages"
  ON public.project_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert project_stages"
  ON public.project_stages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update project_stages"
  ON public.project_stages FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete project_stages"
  ON public.project_stages FOR DELETE TO authenticated USING (public.is_full_admin(auth.uid()));

CREATE TRIGGER trg_project_stages_updated_at
  BEFORE UPDATE ON public.project_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

UPDATE public.production_task_templates SET phase_name = 'Drywall Completion' WHERE phase_name = 'Ceiling';
UPDATE public.production_task_templates SET task_name = REPLACE(task_name, 'Ceiling', 'Drywall Completion') WHERE task_name ILIKE '%Ceiling%';
UPDATE public.project_tasks SET phase = 'Drywall Completion' WHERE phase = 'Ceiling';
UPDATE public.project_tasks SET task_name = REPLACE(task_name, 'Ceiling', 'Drywall Completion') WHERE task_name ILIKE '%Ceiling%';