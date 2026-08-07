ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS actual_completion_date date;

CREATE OR REPLACE FUNCTION public.cwo_start_dlp_on_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.client_work_orders%ROWTYPE; v_start date;
BEGIN
  IF NEW.client_work_order_id IS NULL THEN RETURN NEW; END IF;
  v_start := COALESCE(NEW.actual_completion_date,
                      CASE WHEN lower(COALESCE(NEW.status,'')) IN ('completed','handed over','handed_over') THEN CURRENT_DATE END);
  IF v_start IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO w FROM public.client_work_orders WHERE id = NEW.client_work_order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO public.client_wo_dlp (work_order_id, project_id, dlp_start_date, dlp_months)
  VALUES (w.id, NEW.id, v_start, COALESCE(w.dlp_months, 0))
  ON CONFLICT (project_id) DO UPDATE SET dlp_start_date = EXCLUDED.dlp_start_date, dlp_months = EXCLUDED.dlp_months;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cwo_start_dlp ON public.projects;
CREATE TRIGGER trg_cwo_start_dlp AFTER INSERT OR UPDATE OF actual_completion_date, status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cwo_start_dlp_on_completion();