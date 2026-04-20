-- Task type enum
CREATE TYPE public.task_template_type AS ENUM ('task', 'sub-task', 'qc_gate', 'sign-off', 'payment');

-- Production system enum (matches existing string values)
CREATE TYPE public.production_system_type AS ENUM ('modular', 'panelised', 'hybrid');

-- Master task templates table
CREATE TABLE public.production_task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_system production_system_type NOT NULL,
  stage_number TEXT NOT NULL,
  task_type task_template_type NOT NULL,
  task_name TEXT NOT NULL,
  responsible_role TEXT,
  input_required TEXT,
  output_deliverable TEXT,
  hstack_action TEXT,
  is_qc_gate BOOLEAN NOT NULL DEFAULT false,
  phase_name TEXT NOT NULL,
  typical_duration_days NUMERIC,
  notes TEXT,
  predecessor_stage_numbers TEXT[] DEFAULT ARRAY[]::TEXT[],
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ptt_system_order ON public.production_task_templates (production_system, display_order);
CREATE INDEX idx_ptt_phase ON public.production_task_templates (production_system, phase_name);

ALTER TABLE public.production_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task templates"
  ON public.production_task_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Full admins can insert task templates"
  ON public.production_task_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_full_admin(auth.uid()));

CREATE POLICY "Full admins can update task templates"
  ON public.production_task_templates FOR UPDATE
  TO authenticated
  USING (public.is_full_admin(auth.uid()));

CREATE POLICY "Full admins can delete task templates"
  ON public.production_task_templates FOR DELETE
  TO authenticated
  USING (public.is_full_admin(auth.uid()));

CREATE TRIGGER update_ptt_updated_at
  BEFORE UPDATE ON public.production_task_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();