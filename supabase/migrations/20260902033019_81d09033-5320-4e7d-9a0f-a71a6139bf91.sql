ALTER TABLE public.project_design_stages
  ADD COLUMN IF NOT EXISTS planned_start_date date,
  ADD COLUMN IF NOT EXISTS planned_end_date date;

ALTER TABLE public.design_stage_definitions
  ADD COLUMN IF NOT EXISTS design_schedule_section text,
  ADD COLUMN IF NOT EXISTS template_row integer,
  ADD COLUMN IF NOT EXISTS proof_type text,
  ADD COLUMN IF NOT EXISTS combined_gate_codes text[],
  ADD COLUMN IF NOT EXISTS predecessor_codes text[],
  ADD COLUMN IF NOT EXISTS is_combined_child boolean NOT NULL DEFAULT false;

-- New stage definitions (habitainer)
INSERT INTO public.design_stage_definitions
  (stage_code, stage_name, stage_order, pipeline_type, stage_group, is_mandatory, is_production_gate, is_read_only, deliverable_required, is_combined_child)
VALUES
  ('T-4','Target Dates for Execution — Site',404,'habitainer','Technical',true,false,false,false,false),
  ('T-5','Target Dates for Execution — Factory',405,'habitainer','Technical',true,false,false,false,false),
  ('E-10','Drawings to LGSF / MEP Vendor',510,'habitainer','Design Execution',true,false,false,false,false),
  ('E-11','Drawing Register and Transmittal',511,'habitainer','Design Execution',true,false,false,false,false),
  ('E-1A','S1 Preliminary Sign-off',5011,'habitainer','Design Execution',true,false,false,false,true),
  ('E-1B','H1 Preliminary Sign-off',5013,'habitainer','Design Execution',true,false,false,false,true),
  ('E-2A','S2 Preliminary Sign-off',5021,'habitainer','Design Execution',true,false,false,false,true),
  ('E-2B','H2 Preliminary Sign-off',5023,'habitainer','Design Execution',true,false,false,false,true)
ON CONFLICT DO NOTHING;

-- Template row / section / proof type mapping
UPDATE public.design_stage_definitions d SET
  template_row = m.row_no,
  design_schedule_section = m.section,
  proof_type = m.proof
FROM (VALUES
  ('D-1',1,'DESIGN CONCEPT','WhatsApp screenshot'),
  ('D-2',2,'DESIGN CONCEPT','WhatsApp screenshot'),
  ('D-3',3,'DESIGN CONCEPT','WhatsApp screenshot'),
  ('D-4',4,'DESIGN CONCEPT','WhatsApp screenshot'),
  ('D-5',5,'DESIGN CONCEPT','WhatsApp screenshot'),
  ('T-1',6,'PROJECT CLOSURE','WhatsApp screenshot'),
  ('T-2',7,'PROJECT CLOSURE','WhatsApp screenshot'),
  ('T-3',8,'PROJECT CLOSURE','WhatsApp screenshot'),
  ('E-1',9,'PROJECT CLOSURE','WhatsApp screenshot'),
  ('E-2',10,'PROJECT CLOSURE','WhatsApp screenshot'),
  ('T-4',11,'PROJECT CLOSURE','WhatsApp screenshot'),
  ('T-5',12,'PROJECT CLOSURE','WhatsApp screenshot'),
  ('E-3',13,'DESIGN EXECUTION','Formal email'),
  ('E-5',14,'DESIGN EXECUTION','Formal email'),
  ('E-10',15,'DESIGN EXECUTION','Formal email'),
  ('E-4',16,'DESIGN EXECUTION','Formal email'),
  ('E-6',17,'DESIGN EXECUTION','Formal email'),
  ('E-7',18,'DESIGN EXECUTION','Formal email'),
  ('E-8',19,'DESIGN EXECUTION','Formal email'),
  ('E-11',20,'DESIGN EXECUTION','Formal email'),
  ('E-9',21,'DESIGN EXECUTION','Formal email'),
  ('P-1',22,'DESIGN EXECUTION','Formal email')
) AS m(code,row_no,section,proof)
WHERE d.pipeline_type = 'habitainer' AND d.stage_code = m.code;

-- Combined gate wiring
UPDATE public.design_stage_definitions
   SET combined_gate_codes = ARRAY['E-1A','E-1B']
 WHERE pipeline_type='habitainer' AND stage_code='E-1';
UPDATE public.design_stage_definitions
   SET combined_gate_codes = ARRAY['E-2A','E-2B']
 WHERE pipeline_type='habitainer' AND stage_code='E-2';

-- Final sign-offs require their own preliminary checkpoint
UPDATE public.design_stage_definitions SET predecessor_codes = ARRAY['E-1A'] WHERE pipeline_type='habitainer' AND stage_code='E-3';
UPDATE public.design_stage_definitions SET predecessor_codes = ARRAY['E-1B'] WHERE pipeline_type='habitainer' AND stage_code='E-5';
UPDATE public.design_stage_definitions SET predecessor_codes = ARRAY['E-2A'] WHERE pipeline_type='habitainer' AND stage_code='E-4';
UPDATE public.design_stage_definitions SET predecessor_codes = ARRAY['E-2B'] WHERE pipeline_type='habitainer' AND stage_code='E-6';

-- Extend the existing guard with explicit predecessor_codes enforcement
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
  pcode       text;
  p_status    text;
  p_name      text;
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

    IF def_row.stage_order > 1 AND COALESCE(def_row.is_combined_child, false) = false THEN
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

    IF def_row.predecessor_codes IS NOT NULL THEN
      FOREACH pcode IN ARRAY def_row.predecessor_codes LOOP
        SELECT pds.status, d.stage_name
          INTO p_status, p_name
          FROM public.project_design_stages pds
          JOIN public.design_stage_definitions d ON d.id = pds.stage_definition_id
         WHERE pds.project_id = NEW.project_id
           AND d.pipeline_type = def_row.pipeline_type
           AND d.stage_code = pcode
         LIMIT 1;

        IF p_status IS NOT NULL AND p_status NOT IN ('Completed','Skipped') THEN
          RAISE EXCEPTION
            '% (%) cannot be marked Completed until its preliminary checkpoint % (%) is Completed. It is currently %.',
            COALESCE(def_row.stage_name,'This stage'), COALESCE(def_row.stage_code,'—'),
            COALESCE(p_name, pcode), pcode, p_status;
        END IF;
      END LOOP;
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