-- 1. Add columns
ALTER TABLE public.design_stages
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS expected_deliverable text;

-- 2. Backfill phase from stage_group
UPDATE public.design_stages SET phase = stage_group WHERE phase IS NULL;

-- 3. Backfill expected_deliverable from stage_name
UPDATE public.design_stages ds SET expected_deliverable = m.txt
FROM (VALUES
  ('Initial Meeting',            'Call notes or meeting record'),
  ('Site Visit',                 'Site visit report'),
  ('Design Brief',               'Design brief presentation'),
  ('Concept Design',             'Floor plan + moodboard'),
  ('Schematic Design',           'Floor plan + 3D renders + tentative budget'),
  ('Estimation & Quotation',     'Tender BOQ / formatted quotation'),
  ('S1 — Site Level Design',    'Site plan + MEP site level services drawings'),
  ('S2 — Site Level Execution', 'Detailed construction + MEP drawings'),
  ('H1 — Fabrication Stage',    'Detailed drawings + schedule of openings'),
  ('H2 — MEP & Finishing',      'Detailed MEP drawings + schedule of finishes'),
  ('H3 — Interior Stage',       'Detailed interior drawings + schedule of finishes'),
  ('GFC Budget Submission',      'GFC Budget Excel file'),
  ('Variation Stage',            'Variation Excel file')
) AS m(name, txt)
WHERE ds.stage_name = m.name AND ds.expected_deliverable IS NULL;

-- 4. Normalise approval_method values to the phase-tied strings
UPDATE public.design_stages SET approval_method = 'whatsapp_screenshot' WHERE approval_method = 'whatsapp';
UPDATE public.design_stages SET approval_method = 'formal_email'        WHERE approval_method = 'email';

-- 5. CHECK constraint tying approval_method to phase
ALTER TABLE public.design_stages DROP CONSTRAINT IF EXISTS design_stages_approval_method_phase_chk;
ALTER TABLE public.design_stages ADD CONSTRAINT design_stages_approval_method_phase_chk
  CHECK (
    approval_method IS NULL
    OR (phase = 'pre_deal'  AND approval_method = 'whatsapp_screenshot')
    OR (phase = 'post_deal' AND approval_method = 'formal_email')
  );

-- 6. Sequential gate + deliverable-required gate trigger
CREATE OR REPLACE FUNCTION public.design_stage_transition_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_status text;
  prev_key    text;
BEGIN
  -- Only guard forward transitions to submitted_to_client or client_approved
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

  -- Deliverable-required gate
  IF NEW.status = 'client_approved'
     AND OLD.status IS DISTINCT FROM 'client_approved'
     AND COALESCE(NEW.deliverable_required, false) = true
     AND (NEW.deliverable_url IS NULL OR NEW.deliverable_url = '') THEN
    RAISE EXCEPTION 'Deliverable required: cannot mark stage "%" client_approved without deliverable_url', NEW.stage_name;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_design_stage_transition_guard ON public.design_stages;
CREATE TRIGGER trg_design_stage_transition_guard
BEFORE UPDATE ON public.design_stages
FOR EACH ROW EXECUTE FUNCTION public.design_stage_transition_guard();

-- 7. Update seeder RPC to also populate phase + expected_deliverable
CREATE OR REPLACE FUNCTION public.initialize_design_stages_v13(_project_id uuid, _start date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sz TEXT;
  cursor_date DATE := _start;
  rec RECORD;
  dur INT;
  inserted INT := 0;
BEGIN
  SELECT COALESCE(project_size,'medium') INTO sz FROM public.projects WHERE id = _project_id;
  DELETE FROM public.design_stages WHERE project_id = _project_id;

  FOR rec IN
    SELECT * FROM (VALUES
      (1,  'Initial Meeting',           'pre_deal',  0, 0, 0,  'Call notes or meeting record'),
      (2,  'Site Visit',                 'pre_deal',  1, 1, 1,  'Site visit report'),
      (3,  'Design Brief',               'pre_deal',  1, 2, 2,  'Design brief presentation'),
      (4,  'Concept Design',             'pre_deal',  3, 6, 9,  'Floor plan + moodboard'),
      (5,  'Schematic Design',           'pre_deal',  5, 8, 12, 'Floor plan + 3D renders + tentative budget'),
      (6,  'Estimation & Quotation',     'pre_deal',  2, 3, 5,  'Tender BOQ / formatted quotation'),
      (7,  'S1 — Site Level Design',    'post_deal', 2, 3, 4,  'Site plan + MEP site level services drawings'),
      (8,  'S2 — Site Level Execution', 'post_deal', 2, 4, 7,  'Detailed construction + MEP drawings'),
      (9,  'H1 — Fabrication Stage',    'post_deal', 2, 4, 7,  'Detailed drawings + schedule of openings'),
      (10, 'H2 — MEP & Finishing',      'post_deal', 2, 5, 9,  'Detailed MEP drawings + schedule of finishes'),
      (11, 'H3 — Interior Stage',       'post_deal', 2, 5, 9,  'Detailed interior drawings + schedule of finishes'),
      (12, 'GFC Budget Submission',      'post_deal', 1, 2, 4,  'GFC Budget Excel file'),
      (13, 'Variation Stage',            'post_deal', 1, 1, 1,  'Variation Excel file')
    ) AS t(stage_order, stage_name, phase, dsmall, dmed, dlarge, expected_deliverable)
    ORDER BY stage_order
  LOOP
    dur := CASE sz WHEN 'small' THEN rec.dsmall WHEN 'large' THEN rec.dlarge ELSE rec.dmed END;
    INSERT INTO public.design_stages(
      project_id, stage_name, stage_order, status,
      stage_group, phase, expected_deliverable,
      duration_small_days, duration_medium_days, duration_large_days,
      planned_start_date, planned_end_date, deliverable_required
    ) VALUES (
      _project_id, rec.stage_name, rec.stage_order, 'not_started',
      rec.phase, rec.phase, rec.expected_deliverable,
      rec.dsmall, rec.dmed, rec.dlarge,
      cursor_date, cursor_date + dur,
      CASE WHEN rec.stage_order <= 2 THEN false ELSE true END
    );
    cursor_date := cursor_date + dur + 1;
    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END $$;