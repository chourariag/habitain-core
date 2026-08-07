-- 1. Backfill metadata columns
ALTER TABLE public.project_design_stages
  ADD COLUMN IF NOT EXISTS completion_type text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS backfilled_by uuid,
  ADD COLUMN IF NOT EXISTS backfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_note text,
  ADD COLUMN IF NOT EXISTS original_doc_unavailable boolean NOT NULL DEFAULT false;

ALTER TABLE public.design_stages
  ADD COLUMN IF NOT EXISTS completion_type text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS backfilled_by uuid,
  ADD COLUMN IF NOT EXISTS backfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_note text,
  ADD COLUMN IF NOT EXISTS original_doc_unavailable boolean NOT NULL DEFAULT false;

ALTER TABLE public.project_stages
  ADD COLUMN IF NOT EXISTS completion_type text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS backfilled_by uuid,
  ADD COLUMN IF NOT EXISTS backfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_note text,
  ADD COLUMN IF NOT EXISTS original_doc_unavailable boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.project_design_stages
    ADD CONSTRAINT pds_completion_type_chk CHECK (completion_type IN ('live','completed_pre_hstack'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.design_stages
    ADD CONSTRAINT ds_completion_type_chk CHECK (completion_type IN ('live','completed_pre_hstack'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.project_stages
    ADD CONSTRAINT ps_completion_type_chk CHECK (completion_type IN ('live','completed_pre_hstack'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Backfill audit / lock table
CREATE TABLE IF NOT EXISTS public.project_backfills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('design','production')),
  pipeline_type text,
  starting_stage_code text,
  starting_stage_label text,
  starting_stage_order integer,
  note text NOT NULL,
  original_doc_unavailable boolean NOT NULL DEFAULT false,
  stages_affected integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.project_backfills
    ADD CONSTRAINT project_backfills_project_phase_key UNIQUE (project_id, phase);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.project_backfills TO authenticated;
GRANT ALL ON public.project_backfills TO service_role;
ALTER TABLE public.project_backfills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view backfills" ON public.project_backfills;
CREATE POLICY "Authenticated can view backfills" ON public.project_backfills
  FOR SELECT TO authenticated USING (true);

-- 3. Trigger guard flag: skip side-effects during a backfill transaction
CREATE OR REPLACE FUNCTION public.project_design_stage_transition_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  def_row public.design_stage_definitions%ROWTYPE;
  prev_status text;
  prev_name   text;
  has_file    boolean;
BEGIN
  IF COALESCE(current_setting('hstack.backfill', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'Completed' THEN

    SELECT * INTO def_row
      FROM public.design_stage_definitions
     WHERE id = NEW.stage_definition_id;

    IF def_row.id IS NULL THEN
      RETURN NEW;
    END IF;

    IF def_row.stage_order > 1 THEN
      SELECT pds.status, d.stage_name
        INTO prev_status, prev_name
        FROM public.project_design_stages pds
        JOIN public.design_stage_definitions d ON d.id = pds.stage_definition_id
       WHERE pds.project_id = NEW.project_id
         AND d.pipeline_type = def_row.pipeline_type
         AND d.stage_order = def_row.stage_order - 1
       LIMIT 1;

      IF prev_status IS NOT NULL
         AND prev_status NOT IN ('Completed','Skipped') THEN
        RAISE EXCEPTION
          'Sequential gate: stage % (%) cannot be Completed until previous stage "%" is Completed (currently %)',
          def_row.stage_order, def_row.stage_code,
          COALESCE(prev_name,'(missing)'), prev_status;
      END IF;
    END IF;

    IF COALESCE(def_row.deliverable_required, false) = true THEN
      SELECT EXISTS (
        SELECT 1 FROM public.file_attachments fa
         WHERE fa.entity_type = 'project_design_stage'
           AND fa.entity_id = NEW.id
           AND fa.is_archived = false
      ) INTO has_file;

      IF NOT has_file THEN
        RAISE EXCEPTION
          'Deliverable required: cannot mark stage "%" (%) Completed without attaching a file',
          def_row.stage_name, def_row.stage_code;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.design_stage_transition_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prev_status text;
  prev_key    text;
BEGIN
  IF COALESCE(current_setting('hstack.backfill', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('submitted_to_client', 'client_approved')
     AND NEW.stage_order > 1 THEN
    SELECT status, stage_name INTO prev_status, prev_key
      FROM public.design_stages
     WHERE project_id = NEW.project_id
       AND stage_order = NEW.stage_order - 1
     LIMIT 1;
    IF prev_status IS DISTINCT FROM 'client_approved' THEN
      RAISE EXCEPTION 'Sequential gate: stage % cannot advance until previous stage "%" is client_approved (currently %)',
        NEW.stage_order, COALESCE(prev_key, '(missing)'), COALESCE(prev_status, 'missing');
    END IF;
  END IF;

  IF NEW.status = 'client_approved'
     AND OLD.status IS DISTINCT FROM 'client_approved'
     AND COALESCE(NEW.deliverable_required, false) = true
     AND (NEW.deliverable_url IS NULL OR NEW.deliverable_url = '') THEN
    RAISE EXCEPTION 'Deliverable required: cannot mark stage "%" client_approved without deliverable_url', NEW.stage_name;
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_design_stage_gfc_budget_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _approved_at timestamptz;
  _project_name text;
  _ops_user uuid;
  _kickoff_id uuid;
  _kickoff_deadline timestamptz;
  _setup_deadline timestamptz;
BEGIN
  IF COALESCE(current_setting('hstack.backfill', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.stage_name = 'GFC Budget Submission'
     AND NEW.status = 'complete'
     AND NEW.deliverable_url IS NOT NULL
     AND (COALESCE(OLD.status,'') <> 'complete' OR OLD.deliverable_url IS NULL)
  THEN
    _approved_at := now();
    _kickoff_deadline := _approved_at + interval '24 hours';
    _setup_deadline := _approved_at + interval '72 hours';

    UPDATE public.projects
       SET gfc_budget_approved_at = _approved_at
     WHERE id = NEW.project_id
     RETURNING name INTO _project_name;

    IF EXISTS (SELECT 1 FROM public.kickoff_meetings WHERE project_id = NEW.project_id) THEN
      RETURN NEW;
    END IF;

    SELECT ur.user_id INTO _ops_user
    FROM public.user_roles ur
    WHERE ur.role::text = 'operations_architect'
    LIMIT 1;

    INSERT INTO public.kickoff_meetings(
      project_id, task_assigned_to_id, kickoff_deadline, project_setup_deadline, status
    ) VALUES (
      NEW.project_id, _ops_user, _kickoff_deadline, _setup_deadline, 'pending_initiation'
    ) RETURNING id INTO _kickoff_id;

    INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
    SELECT ur.user_id,
           'Initiate GFC Kickoff Meeting — ' || COALESCE(_project_name,'Project'),
           'GFC complete for ' || COALESCE(_project_name,'project') || '. Initiate kickoff meeting within 24 hours.',
           'GFC complete for ' || COALESCE(_project_name,'project') || '. Initiate kickoff meeting within 24 hours.',
           'kickoff_meeting_initiate', 'action', 'kickoff_meetings', _kickoff_id, 'high'
    FROM public.user_roles ur WHERE ur.role::text = 'operations_architect';
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. The backfill RPC (MD / Super Admin only)
CREATE OR REPLACE FUNCTION public.backfill_project_starting_stage(
  _project_id uuid,
  _phase text,
  _starting_stage_id uuid,
  _note text,
  _doc_unavailable boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _actor_name text;
  _def public.design_stage_definitions%ROWTYPE;
  _stage_order int;
  _stage_code text;
  _stage_label text;
  _pipeline text;
  _affected int := 0;
  _legacy int := 0;
BEGIN
  IF NOT public.is_full_admin(_actor) THEN
    RAISE EXCEPTION 'Only the Managing Director or Super Admin can perform a historical backfill';
  END IF;
  IF _note IS NULL OR length(btrim(_note)) < 10 THEN
    RAISE EXCEPTION 'A backfill note of at least 10 characters is required';
  END IF;
  IF _phase NOT IN ('design','production') THEN
    RAISE EXCEPTION 'Unsupported phase: %', _phase;
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_backfills WHERE project_id = _project_id AND phase = _phase) THEN
    RAISE EXCEPTION 'This project has already been backfilled for the % phase. Backfill is permanently locked.', _phase;
  END IF;

  SELECT display_name INTO _actor_name FROM public.profiles WHERE auth_user_id = _actor LIMIT 1;

  PERFORM set_config('hstack.backfill', 'on', true);

  IF _phase = 'design' THEN
    SELECT d.* INTO _def
      FROM public.design_stage_definitions d
      JOIN public.project_design_stages pds ON pds.stage_definition_id = d.id
     WHERE pds.id = _starting_stage_id AND pds.project_id = _project_id;

    IF _def.id IS NULL THEN
      RAISE EXCEPTION 'Starting stage not found on this project';
    END IF;

    _stage_order := _def.stage_order;
    _stage_code  := _def.stage_code;
    _stage_label := _def.stage_name;
    _pipeline    := _def.pipeline_type;

    UPDATE public.project_design_stages pds
       SET status = 'Completed',
           completion_type = 'completed_pre_hstack',
           backfilled_by = _actor,
           backfilled_at = now(),
           backfill_note = _note,
           original_doc_unavailable = _doc_unavailable,
           actual_date = COALESCE(pds.actual_date, current_date),
           updated_by = _actor,
           updated_at = now()
      FROM public.design_stage_definitions d
     WHERE d.id = pds.stage_definition_id
       AND pds.project_id = _project_id
       AND d.pipeline_type = _pipeline
       AND d.stage_order < _stage_order
       AND pds.status <> 'Completed';
    GET DIAGNOSTICS _affected = ROW_COUNT;

    UPDATE public.design_stages ds
       SET status = 'client_approved',
           completion_type = 'completed_pre_hstack',
           backfilled_by = _actor,
           backfilled_at = now(),
           backfill_note = _note,
           original_doc_unavailable = _doc_unavailable,
           updated_at = now()
     WHERE ds.project_id = _project_id
       AND ds.stage_order < _stage_order
       AND ds.status <> 'client_approved';
    GET DIAGNOSTICS _legacy = ROW_COUNT;
    _affected := _affected + _legacy;

  ELSE
    SELECT stage_number, stage_name INTO _stage_order, _stage_label
      FROM public.project_stages
     WHERE id = _starting_stage_id AND project_id = _project_id;

    IF _stage_order IS NULL THEN
      RAISE EXCEPTION 'Starting stage not found on this project';
    END IF;

    UPDATE public.project_stages
       SET status = 'Completed',
           completion_type = 'completed_pre_hstack',
           backfilled_by = _actor,
           backfilled_at = now(),
           backfill_note = _note,
           original_doc_unavailable = _doc_unavailable,
           actual_end = COALESCE(actual_end, current_date),
           updated_by = _actor,
           updated_at = now()
     WHERE project_id = _project_id
       AND stage_number < _stage_order
       AND status <> 'Completed'
       AND is_na = false;
    GET DIAGNOSTICS _affected = ROW_COUNT;
  END IF;

  INSERT INTO public.project_backfills(
    project_id, phase, pipeline_type, starting_stage_code, starting_stage_label,
    starting_stage_order, note, original_doc_unavailable, stages_affected,
    created_by, created_by_name
  ) VALUES (
    _project_id, _phase, _pipeline, _stage_code, _stage_label,
    _stage_order, _note, _doc_unavailable, _affected,
    _actor, _actor_name
  );

  PERFORM set_config('hstack.backfill', 'off', true);

  RETURN jsonb_build_object(
    'stages_affected', _affected,
    'starting_stage', COALESCE(_stage_code || ' — ', '') || COALESCE(_stage_label,''),
    'phase', _phase
  );
END $function$;

REVOKE ALL ON FUNCTION public.backfill_project_starting_stage(uuid, text, uuid, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.backfill_project_starting_stage(uuid, text, uuid, text, boolean) TO authenticated;