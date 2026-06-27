
-- 1. projects.project_size
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_size TEXT DEFAULT 'medium';
DO $$ BEGIN
  ALTER TABLE public.projects ADD CONSTRAINT projects_project_size_chk CHECK (project_size IN ('small','medium','large'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. design_stages new columns
ALTER TABLE public.design_stages
  ADD COLUMN IF NOT EXISTS deliverable_url TEXT,
  ADD COLUMN IF NOT EXISTS deliverable_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS planned_start_date DATE,
  ADD COLUMN IF NOT EXISTS planned_end_date DATE,
  ADD COLUMN IF NOT EXISTS actual_end_date DATE,
  ADD COLUMN IF NOT EXISTS overdue_alerted_day1 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overdue_alerted_day2 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage_group TEXT,
  ADD COLUMN IF NOT EXISTS duration_small_days INT,
  ADD COLUMN IF NOT EXISTS duration_medium_days INT,
  ADD COLUMN IF NOT EXISTS duration_large_days INT;

DO $$ BEGIN
  ALTER TABLE public.design_stages ADD CONSTRAINT design_stages_group_chk CHECK (stage_group IN ('pre_deal','post_deal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Initializer function — seeds 13 stages for a project with planned dates
CREATE OR REPLACE FUNCTION public.initialize_design_stages_v13(_project_id UUID, _start DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
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

  -- Wipe existing stages so re-init is idempotent
  DELETE FROM public.design_stages WHERE project_id = _project_id;

  FOR rec IN
    SELECT * FROM (VALUES
      (1,  'Initial Meeting',          'pre_deal',  0, 0, 0),
      (2,  'Site Visit',                'pre_deal',  1, 1, 1),
      (3,  'Design Brief',              'pre_deal',  1, 2, 2),
      (4,  'Concept Design',            'pre_deal',  3, 6, 9),
      (5,  'Schematic Design',          'pre_deal',  5, 8, 12),
      (6,  'Estimation & Quotation',    'pre_deal',  2, 3, 5),
      (7,  'S1 — Site Level Design',   'post_deal', 2, 3, 4),
      (8,  'S2 — Site Level Execution','post_deal', 2, 4, 7),
      (9,  'H1 — Fabrication Stage',   'post_deal', 2, 4, 7),
      (10, 'H2 — MEP & Finishing',     'post_deal', 2, 5, 9),
      (11, 'H3 — Interior Stage',      'post_deal', 2, 5, 9),
      (12, 'GFC Budget Submission',     'post_deal', 1, 2, 4),
      (13, 'Variation Stage',           'post_deal', 1, 1, 1)
    ) AS t(stage_order, stage_name, stage_group, dsmall, dmed, dlarge)
    ORDER BY stage_order
  LOOP
    dur := CASE sz WHEN 'small' THEN rec.dsmall WHEN 'large' THEN rec.dlarge ELSE rec.dmed END;
    INSERT INTO public.design_stages(
      project_id, stage_name, stage_order, status,
      stage_group, duration_small_days, duration_medium_days, duration_large_days,
      planned_start_date, planned_end_date, deliverable_required
    ) VALUES (
      _project_id, rec.stage_name, rec.stage_order, 'not_started',
      rec.stage_group, rec.dsmall, rec.dmed, rec.dlarge,
      cursor_date, cursor_date + dur,
      CASE WHEN rec.stage_name IN ('Initial Meeting','Site Visit') THEN false ELSE true END
    );
    cursor_date := cursor_date + dur + 1;
    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END $$;

GRANT EXECUTE ON FUNCTION public.initialize_design_stages_v13(UUID, DATE) TO authenticated, service_role;

-- 4. Recalculate planned dates for an existing project after size change
CREATE OR REPLACE FUNCTION public.recalculate_design_stage_dates(_project_id UUID, _start DATE DEFAULT CURRENT_DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sz TEXT;
  cursor_date DATE := _start;
  rec RECORD;
  dur INT;
BEGIN
  SELECT COALESCE(project_size,'medium') INTO sz FROM public.projects WHERE id = _project_id;
  FOR rec IN SELECT * FROM public.design_stages WHERE project_id = _project_id ORDER BY stage_order LOOP
    dur := CASE sz
      WHEN 'small' THEN COALESCE(rec.duration_small_days,0)
      WHEN 'large' THEN COALESCE(rec.duration_large_days,0)
      ELSE COALESCE(rec.duration_medium_days,0)
    END;
    UPDATE public.design_stages
      SET planned_start_date = cursor_date,
          planned_end_date = cursor_date + dur
      WHERE id = rec.id;
    cursor_date := cursor_date + dur + 1;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.recalculate_design_stage_dates(UUID, DATE) TO authenticated, service_role;

-- 5. Backfill existing projects to the new 13-stage layout
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT id FROM public.projects WHERE is_archived = false LOOP
    PERFORM public.initialize_design_stages_v13(p.id, CURRENT_DATE);
  END LOOP;
END $$;
