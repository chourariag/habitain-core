CREATE OR REPLACE FUNCTION public.guard_backfill_no_live_completions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phase = 'design' THEN
    IF EXISTS (
      SELECT 1 FROM public.project_design_stages
       WHERE project_id = NEW.project_id
         AND status = 'Completed'
         AND COALESCE(completion_type, 'live') = 'live'
    ) OR EXISTS (
      SELECT 1 FROM public.design_stages
       WHERE project_id = NEW.project_id
         AND status IN ('completed', 'client_approved')
         AND COALESCE(completion_type, 'live') = 'live'
    ) THEN
      RAISE EXCEPTION 'This project already has stages completed through the live workflow. Historical backfill is permanently disabled for it.';
    END IF;
  ELSIF NEW.phase = 'production' THEN
    IF EXISTS (
      SELECT 1 FROM public.project_stages
       WHERE project_id = NEW.project_id
         AND lower(COALESCE(status, '')) IN ('completed', 'client_approved')
         AND COALESCE(completion_type, 'live') = 'live'
    ) THEN
      RAISE EXCEPTION 'This project already has production stages completed through the live workflow. Historical backfill is permanently disabled for it.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_backfill_no_live_completions ON public.project_backfills;
CREATE TRIGGER trg_guard_backfill_no_live_completions
BEFORE INSERT ON public.project_backfills
FOR EACH ROW EXECUTE FUNCTION public.guard_backfill_no_live_completions();