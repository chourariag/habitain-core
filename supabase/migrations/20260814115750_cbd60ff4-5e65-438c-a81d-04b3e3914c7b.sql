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
  prev_code   text;
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
      SELECT pds.status, d.stage_name, d.stage_code
        INTO prev_status, prev_name, prev_code
        FROM public.project_design_stages pds
        JOIN public.design_stage_definitions d ON d.id = pds.stage_definition_id
       WHERE pds.project_id = NEW.project_id
         AND d.pipeline_type = def_row.pipeline_type
         AND d.stage_order = def_row.stage_order - 1
       LIMIT 1;

      IF prev_status IS NOT NULL
         AND prev_status NOT IN ('Completed','Skipped') THEN
        RAISE EXCEPTION
          '% (%) cannot be marked Completed until the previous stage, % (%), is Completed. % is currently % .',
          COALESCE(def_row.stage_name, 'This stage'), COALESCE(def_row.stage_code, '—'),
          COALESCE(prev_name, 'the previous stage'), COALESCE(prev_code, '—'),
          COALESCE(prev_code, 'It'), prev_status;
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
      RAISE EXCEPTION '% cannot advance until the previous stage, %, is approved by the client. It is currently % .',
        COALESCE(NEW.stage_name, 'This stage'), COALESCE(prev_key, 'the previous stage'), COALESCE(prev_status, 'not started');
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