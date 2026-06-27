
ALTER TABLE public.daily_measurements
  ADD COLUMN IF NOT EXISTS total_wip_today NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.measurement_line_items
  ADD COLUMN IF NOT EXISTS labour_cost_today NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_cost_today NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wip_today NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS stage_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dm_project_date_factory
  ON public.daily_measurements(project_id, measurement_date)
  WHERE location = 'factory' AND is_archived = false;

CREATE OR REPLACE FUNCTION public.get_active_production_stages_for_project(_project_id UUID)
RETURNS TABLE(stage_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT ps.stage_name
  FROM public.production_stages ps
  JOIN public.modules m ON m.id = ps.module_id
  WHERE m.project_id = _project_id
    AND COALESCE(ps.is_archived,false) = false
    AND ps.status IN ('pending','in_progress')
  ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION public.get_project_material_cost_for_date(_project_id UUID, _on_date DATE)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(basic_amount_excl_gst),0)::numeric
  FROM public.project_grns
  WHERE project_id = _project_id
    AND COALESCE(invoice_date, received_at::date) = _on_date
$$;

CREATE OR REPLACE FUNCTION public.get_labour_rate_for_trade(_trade TEXT)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT rate_per_unit
  FROM public.rate_cards
  WHERE trade = _trade AND COALESCE(is_archived,false) = false
  ORDER BY effective_from DESC NULLS LAST, created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_boq_totals_by_stage(_project_id UUID)
RETURNS TABLE(stage TEXT, unit TEXT, trade TEXT, boq_qty NUMERIC, boq_rate NUMERIC, first_boq_item_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH g AS (
    SELECT COALESCE(b.stage,'Unassigned') AS stage,
           MIN(b.unit)  AS unit,
           MIN(b.trade) AS trade,
           SUM(b.boq_qty)::numeric AS boq_qty,
           AVG(b.boq_rate)::numeric AS boq_rate
    FROM public.boq_items b
    WHERE b.project_id = _project_id AND b.is_archived = false
    GROUP BY COALESCE(b.stage,'Unassigned')
  )
  SELECT g.stage, g.unit, g.trade, g.boq_qty, g.boq_rate,
         (SELECT id FROM public.boq_items
           WHERE project_id = _project_id
             AND COALESCE(stage,'Unassigned') = g.stage
             AND is_archived = false
           ORDER BY created_at LIMIT 1) AS first_boq_item_id
  FROM g
$$;

CREATE OR REPLACE FUNCTION public.get_project_wip_summary(_project_id UUID, _on_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  on_date DATE,
  labour_today NUMERIC, material_today NUMERIC, wip_today NUMERIC,
  labour_yday NUMERIC,  material_yday NUMERIC,  wip_yday NUMERIC,
  cumulative_wip NUMERIC, boq_total NUMERIC, pct_consumed NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH d AS (
    SELECT id, measurement_date FROM public.daily_measurements
    WHERE project_id = _project_id AND location='factory' AND is_archived = false
  ),
  agg AS (
    SELECT d.measurement_date,
      COALESCE(SUM(mli.labour_cost_today),0) AS labour,
      COALESCE(SUM(mli.material_cost_today),0) AS material,
      COALESCE(SUM(mli.wip_today),0) AS wip
    FROM d LEFT JOIN public.measurement_line_items mli ON mli.measurement_id = d.id
    GROUP BY d.measurement_date
  ),
  today AS (SELECT * FROM agg WHERE measurement_date = _on_date),
  yday  AS (SELECT * FROM agg WHERE measurement_date = _on_date - 1),
  total AS (SELECT COALESCE(SUM(wip),0) AS cum FROM agg WHERE measurement_date <= _on_date),
  budget AS (SELECT COALESCE(SUM(boq_qty * boq_rate),0) AS b FROM public.boq_items WHERE project_id=_project_id AND is_archived=false)
  SELECT
    _on_date,
    COALESCE((SELECT labour FROM today),0),
    COALESCE((SELECT material FROM today),0),
    COALESCE((SELECT wip FROM today),0),
    COALESCE((SELECT labour FROM yday),0),
    COALESCE((SELECT material FROM yday),0),
    COALESCE((SELECT wip FROM yday),0),
    (SELECT cum FROM total),
    (SELECT b FROM budget),
    CASE WHEN (SELECT b FROM budget) > 0
      THEN ROUND(((SELECT cum FROM total) / (SELECT b FROM budget)) * 100, 2)
      ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.notify_costing_on_measurement_submit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pname TEXT;
  recip RECORD;
BEGIN
  IF NEW.submitted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    SELECT project_name INTO pname FROM public.projects WHERE id = NEW.project_id;
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('costing_engineer','production_head','head_operations','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, category, title, message, navigate_to, priority)
      VALUES (recip.auth_user_id, 'measurement',
              'Daily measurement submitted',
              'Daily measurement submitted for ' || COALESCE(pname,'project') || '. Review WIP.',
              '/production?project=' || NEW.project_id || '&tab=measurement',
              'normal');
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_measurement_submit ON public.daily_measurements;
CREATE TRIGGER trg_notify_measurement_submit
AFTER INSERT OR UPDATE OF submitted_at ON public.daily_measurements
FOR EACH ROW EXECUTE FUNCTION public.notify_costing_on_measurement_submit();

DROP POLICY IF EXISTS "production_photos_insert_supervisor" ON storage.objects;
DROP POLICY IF EXISTS "production_photos_select_leadership" ON storage.objects;
DROP POLICY IF EXISTS "production_photos_delete_md" ON storage.objects;

CREATE POLICY "production_photos_insert_supervisor"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'production-photos'
    AND public.user_has_any_role(
      auth.uid(),
      ARRAY['factory_floor_supervisor','production_head','head_operations','super_admin','managing_director']::app_role[]
    )
  );

CREATE POLICY "production_photos_select_leadership"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'production-photos'
    AND public.user_has_any_role(
      auth.uid(),
      ARRAY['factory_floor_supervisor','production_head','head_operations','head_of_projects',
            'managing_director','super_admin','costing_engineer','planning_head','finance_director']::app_role[]
    )
  );

CREATE POLICY "production_photos_delete_md"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'production-photos' AND public.is_md(auth.uid()));
