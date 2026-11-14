CREATE TABLE public.site_report_quantities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.daily_measurements(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  boq_item_id uuid NOT NULL REFERENCES public.project_boq_items(id),
  today_qty numeric NOT NULL DEFAULT 0 CHECK (today_qty >= 0),
  remarks text,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, boq_item_id)
);
GRANT SELECT ON public.site_report_quantities TO authenticated;
GRANT ALL ON public.site_report_quantities TO service_role;
ALTER TABLE public.site_report_quantities ENABLE ROW LEVEL SECURITY;
CREATE POLICY srq_read ON public.site_report_quantities FOR SELECT TO authenticated
  USING (public.user_can_access_project(auth.uid(), project_id));
CREATE INDEX site_report_quantities_report_idx ON public.site_report_quantities(report_id);
CREATE INDEX site_report_quantities_boq_idx ON public.site_report_quantities(boq_item_id);

-- Copy only compatible site-report rows, leaving all legacy rows and foreign keys intact.
INSERT INTO public.site_report_quantities(report_id,project_id,boq_item_id,today_qty,remarks,created_by,updated_by,created_at,updated_at)
SELECT d.id,d.project_id,m.boq_item_id,m.today_qty,m.remarks,d.created_by,d.updated_by,d.created_at,d.updated_at
FROM public.measurement_line_items m
JOIN public.daily_measurements d ON d.id=m.measurement_id
JOIN public.project_boq_items b ON b.id=m.boq_item_id
JOIN public.project_boq h ON h.id=b.boq_id AND h.project_id=d.project_id
WHERE d.trade='daily_site_report'
ON CONFLICT (report_id,boq_item_id) DO NOTHING;

DROP INDEX IF EXISTS public.uq_mli_site_report_boq;

-- Preserve the current authorization, logging, elevations, and older-report protections.
DO $patch$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.save_site_report_draft(uuid,date,jsonb)'::regprocedure);
  d := replace(d, 'FROM public.measurement_line_items WHERE measurement_id=r.id', 'FROM public.site_report_quantities WHERE report_id=r.id');
  d := replace(d, 'INSERT INTO public.measurement_line_items(measurement_id,boq_item_id,today_qty,remarks)',
    'INSERT INTO public.site_report_quantities(report_id,project_id,boq_item_id,today_qty,remarks,created_by,updated_by)');
  d := replace(d, 'VALUES (r.id,v_bid,greatest(coalesce(nullif(e->>''today_qty'','''')::numeric,0),0),nullif(e->>''remarks'',''''))',
    'VALUES (r.id,p_project_id,v_bid,greatest(coalesce(nullif(e->>''today_qty'','''')::numeric,0),0),nullif(e->>''remarks'',''''),auth.uid(),auth.uid())');
  d := replace(d, 'ON CONFLICT (measurement_id,boq_item_id) DO UPDATE SET today_qty=excluded.today_qty, remarks=excluded.remarks;',
    'ON CONFLICT (report_id,boq_item_id) DO UPDATE SET today_qty=excluded.today_qty, remarks=excluded.remarks, updated_by=auth.uid(), updated_at=now();');
  IF position('measurement_line_items' in d)>0 OR position('VALUES (r.id,p_project_id,v_bid' in d)=0 OR position('ON CONFLICT (report_id,boq_item_id)' in d)=0 THEN
    RAISE EXCEPTION 'save_site_report_draft quantities patch did not apply'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.get_site_report(uuid,date)'::regprocedure);
  d := replace(d, 'public.measurement_line_items', 'public.site_report_quantities');
  d := replace(d, 'li.measurement_id', 'li.report_id');
  d := replace(d, 'WHERE measurement_id=r.id', 'WHERE report_id=r.id');
  IF position('measurement_id' in d)>0 OR position('measurement_line_items' in d)>0 THEN
    RAISE EXCEPTION 'get_site_report quantities patch did not apply'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.submit_site_report(uuid)'::regprocedure);
  d := replace(d, 'public.measurement_line_items', 'public.site_report_quantities');
  d := replace(d, 'li.measurement_id', 'li.report_id');
  IF position('measurement_line_items' in d)>0 OR position('li.measurement_id' in d)>0 THEN
    RAISE EXCEPTION 'submit_site_report quantities patch did not apply'; END IF;
  EXECUTE d;
END $patch$;