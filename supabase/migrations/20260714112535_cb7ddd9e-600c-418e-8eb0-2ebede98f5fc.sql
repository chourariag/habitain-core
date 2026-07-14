
-- 1. Add missing columns to design_stages
ALTER TABLE public.design_stages
  ADD COLUMN IF NOT EXISTS deliverable_filename text,
  ADD COLUMN IF NOT EXISTS deliverable_uploaded_at timestamptz;

-- Backfill deliverable_uploaded_at for existing rows that already have a deliverable_url
UPDATE public.design_stages
   SET deliverable_uploaded_at = COALESCE(updated_at, created_at, now())
 WHERE deliverable_url IS NOT NULL
   AND deliverable_url <> ''
   AND deliverable_uploaded_at IS NULL;

-- 2. Add deliverable_required to catalog
ALTER TABLE public.design_stage_definitions
  ADD COLUMN IF NOT EXISTS deliverable_required boolean NOT NULL DEFAULT false;

-- Seed deliverable_required = true for the production-gating catalog codes
UPDATE public.design_stage_definitions
   SET deliverable_required = true
 WHERE pipeline_type = 'habitainer'
   AND stage_code IN ('E-3','E-5','E-8','P-1');

-- 3. Add deliverable columns to project_design_stages
ALTER TABLE public.project_design_stages
  ADD COLUMN IF NOT EXISTS deliverable_url text,
  ADD COLUMN IF NOT EXISTS deliverable_filename text,
  ADD COLUMN IF NOT EXISTS deliverable_uploaded_at timestamptz;

-- 4. Port sequential-gate + deliverable-mandatory guards to project_design_stages
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
BEGIN
  -- Only guard when status is transitioning INTO 'Completed'
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'Completed' THEN

    SELECT * INTO def_row
      FROM public.design_stage_definitions
     WHERE id = NEW.stage_definition_id;

    IF def_row.id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Sequential gate: previous stage_order in same pipeline for this project
    -- must be Completed or Skipped before this one can be Completed.
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

    -- Deliverable-mandatory gate
    IF COALESCE(def_row.deliverable_required, false) = true
       AND (NEW.deliverable_url IS NULL OR NEW.deliverable_url = '') THEN
      RAISE EXCEPTION
        'Deliverable required: cannot mark stage "%" (%) Completed without uploading a deliverable',
        def_row.stage_name, def_row.stage_code;
    END IF;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_project_design_stage_transition_guard ON public.project_design_stages;
CREATE TRIGGER trg_project_design_stage_transition_guard
  BEFORE UPDATE ON public.project_design_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.project_design_stage_transition_guard();
