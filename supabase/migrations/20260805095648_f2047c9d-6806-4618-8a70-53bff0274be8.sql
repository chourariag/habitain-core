-- 1) Sync function: keep project_design_stages.deliverable_url/filename as a denormalized
--    pointer to the latest live attachment (single source of truth = file_attachments)
CREATE OR REPLACE FUNCTION public.sync_design_stage_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_id uuid;
  latest RECORD;
BEGIN
  target_id := COALESCE(NEW.entity_id, OLD.entity_id);
  IF COALESCE(NEW.entity_type, OLD.entity_type) IS DISTINCT FROM 'project_design_stage' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT fa.storage_path, fa.file_name
    INTO latest
    FROM public.file_attachments fa
   WHERE fa.entity_type = 'project_design_stage'
     AND fa.entity_id = target_id
     AND fa.is_archived = false
   ORDER BY fa.uploaded_at DESC NULLS LAST
   LIMIT 1;

  UPDATE public.project_design_stages
     SET deliverable_url = latest.storage_path,
         deliverable_filename = latest.file_name
   WHERE id = target_id;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_sync_design_stage_deliverable ON public.file_attachments;
CREATE TRIGGER trg_sync_design_stage_deliverable
AFTER INSERT OR UPDATE OR DELETE ON public.file_attachments
FOR EACH ROW EXECUTE FUNCTION public.sync_design_stage_deliverable();

-- 2) Guard: accept a live file_attachments row as a valid deliverable
CREATE OR REPLACE FUNCTION public.project_design_stage_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  def_row public.design_stage_definitions%ROWTYPE;
  prev_status text;
  prev_name   text;
  has_file    boolean;
BEGIN
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
END $$;

-- 3) Backfill the denormalized pointer for every stage that already has a live attachment
UPDATE public.project_design_stages pds
   SET deliverable_url = sub.storage_path,
       deliverable_filename = sub.file_name
  FROM (
    SELECT DISTINCT ON (f.entity_id)
           f.entity_id, f.storage_path, f.file_name
      FROM public.file_attachments f
     WHERE f.entity_type = 'project_design_stage'
       AND f.is_archived = false
     ORDER BY f.entity_id, f.uploaded_at DESC NULLS LAST
  ) sub
 WHERE sub.entity_id = pds.id
   AND pds.deliverable_url IS NULL;