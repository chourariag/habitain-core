-- Phase 1-4: Task Template System
-- Add metadata columns to project_tasks to store template-derived info

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS task_type public.task_template_type NOT NULL DEFAULT 'task',
  ADD COLUMN IF NOT EXISTS is_qc_gate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order integer,
  ADD COLUMN IF NOT EXISTS stage_number text,
  ADD COLUMN IF NOT EXISTS parent_stage_number text,
  ADD COLUMN IF NOT EXISTS input_required text,
  ADD COLUMN IF NOT EXISTS output_deliverable text,
  ADD COLUMN IF NOT EXISTS hstack_action text,
  ADD COLUMN IF NOT EXISTS lock_override_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_project_tasks_display_order
  ON public.project_tasks(project_id, display_order);

-- Function to clone production_task_templates into a project's task list
CREATE OR REPLACE FUNCTION public.clone_task_templates_to_project(_project_id uuid, _system text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  sys public.production_system_type;
BEGIN
  IF _system IS NULL OR _system NOT IN ('modular','panelised','hybrid') THEN
    RETURN 0;
  END IF;
  sys := _system::public.production_system_type;

  -- Wipe any prior rows for this project (template-driven re-clone)
  DELETE FROM public.project_tasks WHERE project_id = _project_id;

  WITH inserted AS (
    INSERT INTO public.project_tasks (
      project_id, task_id_in_schedule, task_name, phase,
      duration_days, predecessor_ids, responsible_role,
      status, completion_percentage, delay_days, is_locked,
      task_type, is_qc_gate, display_order, stage_number,
      input_required, output_deliverable, hstack_action, remarks
    )
    SELECT
      _project_id,
      t.stage_number,
      t.task_name,
      t.phase_name,
      COALESCE(t.typical_duration_days, 0)::int,
      COALESCE(t.predecessor_stage_numbers, ARRAY[]::text[]),
      t.responsible_role,
      'Upcoming',
      0,
      0,
      COALESCE(array_length(t.predecessor_stage_numbers, 1), 0) > 0,
      t.task_type,
      COALESCE(t.is_qc_gate, false),
      t.display_order,
      t.stage_number,
      t.input_required,
      t.output_deliverable,
      t.hstack_action,
      t.notes
    FROM public.production_task_templates t
    WHERE t.production_system = sys
    ORDER BY t.display_order
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM inserted;

  RETURN inserted_count;
END;
$$;

-- Trigger on projects: auto-clone when production_system is set/changed
CREATE OR REPLACE FUNCTION public.trg_clone_templates_on_project_system_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_existing integer;
BEGIN
  IF NEW.production_system IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.clone_task_templates_to_project(NEW.id, NEW.production_system);
    RETURN NEW;
  END IF;

  -- UPDATE: only clone if the system changed
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.production_system,'') IS DISTINCT FROM COALESCE(NEW.production_system,'') THEN
    -- Avoid wiping a project that already has user-edited tasks unless empty
    SELECT count(*) INTO has_existing FROM public.project_tasks WHERE project_id = NEW.id;
    IF has_existing = 0 THEN
      PERFORM public.clone_task_templates_to_project(NEW.id, NEW.production_system);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_clone_task_templates ON public.projects;
CREATE TRIGGER projects_clone_task_templates
AFTER INSERT OR UPDATE OF production_system ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.trg_clone_templates_on_project_system_change();

-- Allow Karthik (planning_engineer) and MD/super_admin to call clone manually if needed
GRANT EXECUTE ON FUNCTION public.clone_task_templates_to_project(uuid, text) TO authenticated;
