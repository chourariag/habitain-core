-- Rename the drywall stage everywhere
UPDATE public.production_task_templates
   SET phase_name = 'Drywall Works Completion'
 WHERE phase_name IN ('Drywall Completion','Ceiling');

UPDATE public.production_task_templates
   SET stage_name = 'Drywall Works Completion'
 WHERE stage_name IN ('Drywall Completion','Ceiling');

UPDATE public.production_task_templates
   SET task_name = REPLACE(task_name, 'Drywall Completion', 'Drywall Works Completion')
 WHERE task_name ILIKE '%Drywall Completion%';

UPDATE public.project_tasks
   SET phase = 'Drywall Works Completion'
 WHERE phase IN ('Drywall Completion','Ceiling');

UPDATE public.project_tasks
   SET stage_name = 'Drywall Works Completion'
 WHERE stage_name IN ('Drywall Completion','Ceiling');

UPDATE public.project_tasks
   SET task_name = REPLACE(task_name, 'Drywall Completion', 'Drywall Works Completion')
 WHERE task_name ILIKE '%Drywall Completion%';

UPDATE public.project_stages
   SET stage_name = 'Drywall Works Completion'
 WHERE stage_name IN ('Drywall Completion','Ceiling');

-- Site schedule trigger tracking on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS site_schedule_unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS site_schedule_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS site_schedule_escalated_at timestamptz;