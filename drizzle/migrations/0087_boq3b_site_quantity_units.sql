-- BOQ-3b: optional unit split for site BOQ quantities. Writes only through site_set_quantity_units.
CREATE TABLE public.site_quantity_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity_id uuid NOT NULL REFERENCES public.site_report_quantities(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  unit_kind text NOT NULL,
  unit_label text NOT NULL,
  qty numeric NOT NULL CHECK (qty > 0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quantity_id, unit_kind, unit_label)
);
CREATE INDEX site_quantity_units_project_idx ON public.site_quantity_units(project_id);
REVOKE ALL ON public.site_quantity_units FROM anon, authenticated;
GRANT SELECT ON public.site_quantity_units TO authenticated;
GRANT ALL ON public.site_quantity_units TO service_role;
ALTER TABLE public.site_quantity_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY squ_read ON public.site_quantity_units FOR SELECT TO authenticated
  USING (public.user_can_access_project(auth.uid(), project_id));

CREATE OR REPLACE FUNCTION public.site_set_quantity_units(p_quantity uuid, p_split jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE q public.site_report_quantities%ROWTYPE; r public.daily_measurements%ROWTYPE; v_loc text; v_set uuid;
  e jsonb; v_kind text; v_label text; v_qty numeric; v_total numeric := 0; v_old text; v_new text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  SELECT * INTO q FROM public.site_report_quantities WHERE id=p_quantity FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Quantity row not found' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.daily_measurements WHERE id=q.report_id FOR UPDATE;
  -- Same rule as save_site_report_draft: writer for the project, 3-day window, submitted reports only by their submitter.
  IF r.id IS NULL OR r.trade<>'daily_site_report' OR coalesce(r.is_archived,false)
     OR NOT public.can_write_site_report(auth.uid(), r.project_id)
     OR r.measurement_date > public.site_report_today() OR r.measurement_date < public.site_report_today() - 2
     OR (r.report_status='submitted' AND r.submitted_by IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'You cannot edit this site report' USING ERRCODE='42501';
  END IF;
  IF q.boq_item_id IS NULL THEN RAISE EXCEPTION 'Other work has no BOQ units'; END IF;
  SELECT lower(btrim(coalesce(work_location,''))) INTO v_loc FROM public.project_boq_items WHERE id=q.boq_item_id;
  IF v_loc='factory' THEN RAISE EXCEPTION 'Factory lines are reported in the Daily Factory Report'; END IF;
  IF v_loc<>'site' THEN RAISE EXCEPTION 'Only site BOQ lines can have a unit split'; END IF;
  IF p_split IS NULL OR jsonb_typeof(p_split)<>'array' THEN RAISE EXCEPTION 'Unit split must be a list'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_split) x GROUP BY x->>'unit_kind', x->>'unit_label' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Each unit can appear only once'; END IF;
  SELECT id INTO v_set FROM public.boq_link_sets WHERE project_id=q.project_id AND NOT is_archived;
  FOR e IN SELECT value FROM jsonb_array_elements(p_split) LOOP
    v_kind := e->>'unit_kind'; v_label := e->>'unit_label';
    BEGIN v_qty := (e->>'qty')::numeric; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Quantity for unit % must be a number', coalesce(v_label,'?'); END;
    IF v_qty IS NULL OR v_qty='NaN'::numeric OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for unit % must be more than 0', coalesce(v_label,'?'); END IF;
    IF v_set IS NULL OR NOT EXISTS (SELECT 1 FROM public.boq_unit_allocations a WHERE a.link_set_id=v_set AND a.boq_item_id=q.boq_item_id
        AND a.unit_kind=v_kind AND a.unit_label=v_label AND NOT a.is_archived) THEN
      RAISE EXCEPTION 'Unit % is not allocated to this BOQ line', coalesce(v_label,'?');
    END IF;
    v_total := v_total + v_qty;
  END LOOP;
  IF v_total > q.today_qty THEN RAISE EXCEPTION 'Unit split (%) is more than the quantity reported today (%)', v_total, q.today_qty; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'qty',qty) ORDER BY unit_kind,unit_label),'[]')::text INTO v_old
    FROM public.site_quantity_units WHERE quantity_id=q.id;
  DELETE FROM public.site_quantity_units s WHERE s.quantity_id=q.id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_split) x WHERE x->>'unit_kind'=s.unit_kind AND x->>'unit_label'=s.unit_label);
  INSERT INTO public.site_quantity_units(quantity_id,project_id,unit_kind,unit_label,qty,created_by,updated_by)
  SELECT q.id,q.project_id,x->>'unit_kind',x->>'unit_label',(x->>'qty')::numeric,auth.uid(),auth.uid() FROM jsonb_array_elements(p_split) x
  ON CONFLICT (quantity_id,unit_kind,unit_label) DO UPDATE SET qty=excluded.qty, updated_by=auth.uid(), updated_at=now()
    WHERE site_quantity_units.qty IS DISTINCT FROM excluded.qty;
  SELECT coalesce(jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'qty',qty) ORDER BY unit_kind,unit_label),'[]')::text INTO v_new
    FROM public.site_quantity_units WHERE quantity_id=q.id;
  IF v_old IS DISTINCT FROM v_new THEN PERFORM public._site_report_log(r.id, r.project_id, 'unit_split:'||q.id, v_old, v_new); END IF;
  RETURN jsonb_build_object('quantity_id',q.id,'split_total',v_total,'unassigned',q.today_qty-v_total);
END $$;
REVOKE ALL ON FUNCTION public.site_set_quantity_units(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_set_quantity_units(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.site_get_quantity_units(p_report uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE r public.daily_measurements%ROWTYPE; v_set uuid;
BEGIN
  SELECT * INTO r FROM public.daily_measurements WHERE id=p_report AND trade='daily_site_report';
  -- Same read rule as get_site_report: project access.
  IF auth.uid() IS NULL OR r.id IS NULL OR NOT public.user_can_access_project(auth.uid(), r.project_id) THEN
    RAISE EXCEPTION 'No access to this project' USING ERRCODE='42501';
  END IF;
  SELECT id INTO v_set FROM public.boq_link_sets WHERE project_id=r.project_id AND NOT is_archived;
  RETURN jsonb_build_object('report_id', r.id, 'quantities', coalesce((
    SELECT jsonb_agg(jsonb_build_object('quantity_id',q.id,'boq_item_id',q.boq_item_id,'contractor_id',q.contractor_id,'today_qty',q.today_qty,
      'work_location',lower(btrim(coalesce(b.work_location,''))),
      'split',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',s.unit_kind,'unit_label',s.unit_label,'qty',s.qty) ORDER BY s.unit_kind,s.unit_label)
         FROM public.site_quantity_units s WHERE s.quantity_id=q.id),'[]'),
      'allocated',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',a.unit_kind,'unit_label',a.unit_label,'qty',a.quantity) ORDER BY a.unit_kind,a.unit_label)
         FROM public.boq_unit_allocations a WHERE a.link_set_id=v_set AND a.boq_item_id=q.boq_item_id AND NOT a.is_archived),'[]'),
      'split_total',st.t,'unassigned',q.today_qty-st.t,'stale',st.t>q.today_qty) ORDER BY q.created_at)
    FROM public.site_report_quantities q JOIN public.project_boq_items b ON b.id=q.boq_item_id
    CROSS JOIN LATERAL (SELECT coalesce(sum(s.qty),0) t FROM public.site_quantity_units s WHERE s.quantity_id=q.id) st
    WHERE q.report_id=r.id),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.site_get_quantity_units(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_get_quantity_units(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.boq3_task_report(p_project uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE s public.boq_link_sets; st jsonb; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.boq2_can_read(p_project) THEN
  RAISE EXCEPTION 'You do not have access to this project''s BOQ links.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.boq_link_sets WHERE project_id=p_project AND NOT is_archived;
 IF s.id IS NULL OR s.status<>'locked' THEN RETURN jsonb_build_object('status','no_locked_links'); END IF;
 st := public._boq2_state(p_project);
 WITH lk AS (
  SELECT (l->>'id')::uuid boq_item_id,(l->>'sno')::int sno,l->>'description' description,l->>'unit' uom,
   (k->>'id')::uuid link_id,k->>'unit_kind' unit_kind,k->>'unit_label' unit_label,(k->>'task_id')::uuid task_id,k->>'code' code,k->>'task_name' task_name,
   (k->>'share_pct')::numeric share_pct,(k->>'budget')::numeric budget,k->>'problem' problem,
   coalesce((SELECT (a->>'quantity')::numeric FROM jsonb_array_elements(l->'allocations') a WHERE a->>'unit_kind'=k->>'unit_kind' AND a->>'unit_label'=k->>'unit_label' LIMIT 1),0) alloc_qty,
   lower(btrim(coalesce(i.work_location,''))) loc
  FROM jsonb_array_elements(st->'lines') l CROSS JOIN LATERAL jsonb_array_elements(l->'links') k
  JOIN public.project_boq_items i ON i.id=(l->>'id')::uuid),
 units AS (SELECT DISTINCT unit_kind,unit_label FROM lk WHERE loc='factory'),
 unit_link AS (
  SELECT u.unit_kind,u.unit_label,su.module_id linked_module_id,linked.id linked_id,linked.is_archived linked_archived
  FROM units u
  LEFT JOIN public.project_schedule_units su ON su.project_id=p_project AND su.unit_kind=u.unit_kind AND su.unit_label=u.unit_label
  LEFT JOIN public.modules linked ON linked.id=su.module_id AND linked.project_id=p_project),
 umap AS (SELECT ul.unit_kind,ul.unit_label,ul.linked_module_id,ul.linked_id,ul.linked_archived,m.ids,
   (SELECT coalesce(jsonb_agg(mo.name ORDER BY mo.name),'[]') FROM public.modules mo WHERE mo.project_id=p_project AND NOT mo.is_archived) all_names
  FROM unit_link ul LEFT JOIN LATERAL (SELECT array_agg(mo.id) ids FROM public.modules mo WHERE ul.linked_module_id IS NULL AND mo.project_id=p_project AND NOT mo.is_archived AND ul.unit_kind='module'
    AND (lower(btrim(coalesce(mo.name,'')))=lower(btrim(ul.unit_label)) OR lower(btrim(coalesce(mo.module_code,'')))=lower(btrim(ul.unit_label)))) m ON true),
 um AS (SELECT unit_kind,unit_label,
   CASE WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND NOT linked_archived THEN linked_module_id
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=1 THEN ids[1] END module_id,
   CASE WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND NOT linked_archived THEN 'link'
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=1 THEN 'name' END mapped_by,
   CASE WHEN unit_kind<>'module' THEN 'Not a module unit'
        WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND linked_archived THEN 'Linked module is archived'
        WHEN linked_module_id IS NOT NULL AND linked_id IS NULL THEN 'Linked module is not available'
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=0 THEN 'No module matches this unit label'
        WHEN linked_module_id IS NULL AND cardinality(ids)>1 THEN 'More than one module matches this unit label' END unmapped_reason,
   all_names FROM umap),
 cons AS (SELECT q.boq_item_id,q.module_id,sum(coalesce(q.today_qty,0)) c,sum(coalesce(q.amount_inr,0)) amt
  FROM public.factory_report_quantities q JOIN public.factory_daily_reports r ON r.id=q.report_id
  JOIN public.modules mo ON mo.id=q.module_id AND mo.project_id=p_project
  WHERE NOT q.is_archived AND NOT r.is_archived AND r.status='submitted' GROUP BY 1,2),
 calc AS (SELECT lk.*,um.module_id,um.unmapped_reason,coalesce(c.c,0) consumed,coalesce(c.amt,0) amt,
   CASE WHEN lk.problem IS NOT NULL OR um.module_id IS NULL OR lk.alloc_qty=0 THEN 0 ELSE round(lk.budget*coalesce(c.c,0)/lk.alloc_qty,2) END earned,
   CASE WHEN lk.problem IS NOT NULL OR um.module_id IS NULL THEN 0 ELSE round(coalesce(c.amt,0)*lk.share_pct/100,2) END actual,
   greatest(coalesce(c.c,0)-lk.alloc_qty,0) overrun_qty
  FROM lk JOIN um USING (unit_kind,unit_label)
  LEFT JOIN cons c ON c.boq_item_id=lk.boq_item_id AND c.module_id=um.module_id WHERE lk.loc='factory'),
 tasks AS (SELECT unit_kind,unit_label,task_id,max(code) code,max(task_name) task_name,sum(budget) budget,sum(earned) earned,sum(actual) actual,
   bool_or(overrun_qty>0) overrun,bool_or(problem IS NOT NULL) broken,count(*) links FROM calc GROUP BY 1,2,3),
 site AS (SELECT boq_item_id,min(sno) sno,max(description) description,max(uom) uom,sum(budget) budget FROM lk WHERE loc<>'factory' GROUP BY 1),
 srow AS (SELECT q.id,q.boq_item_id,q.today_qty,coalesce(q.amount_inr,0) amt,
   coalesce((SELECT sum(x.qty) FROM public.site_quantity_units x WHERE x.quantity_id=q.id),0) split_total
  FROM public.site_report_quantities q JOIN public.daily_measurements d ON d.id=q.report_id
  WHERE q.project_id=p_project AND d.project_id=p_project AND d.trade='daily_site_report' AND d.report_status='submitted'
   AND coalesce(d.is_archived,false)=false AND q.boq_item_id IS NOT NULL),
 scons AS (SELECT r.boq_item_id,x.unit_kind,x.unit_label,sum(x.qty) c,
   sum(CASE WHEN r.today_qty>0 THEN r.amt*x.qty/r.today_qty ELSE 0 END) amt
  FROM srow r JOIN public.site_quantity_units x ON x.quantity_id=r.id WHERE r.split_total<=r.today_qty GROUP BY 1,2,3),
 sline AS (SELECT boq_item_id,sum(CASE WHEN split_total<=today_qty THEN today_qty-split_total ELSE 0 END) unassigned,
   bool_or(split_total>today_qty) stale FROM srow GROUP BY 1),
 scalc AS (SELECT lk.*,coalesce(c.c,0) consumed,coalesce(c.amt,0) amt,
   CASE WHEN lk.problem IS NOT NULL OR lk.alloc_qty=0 THEN 0 ELSE round(lk.budget*coalesce(c.c,0)/lk.alloc_qty,2) END earned,
   CASE WHEN lk.problem IS NOT NULL THEN 0 ELSE round(coalesce(c.amt,0)*lk.share_pct/100,2) END actual,
   greatest(coalesce(c.c,0)-lk.alloc_qty,0) overrun_qty
  FROM lk LEFT JOIN scons c ON c.boq_item_id=lk.boq_item_id AND c.unit_kind=lk.unit_kind AND c.unit_label=lk.unit_label WHERE lk.loc='site'),
 stasks AS (SELECT unit_kind,unit_label,task_id,max(code) code,max(task_name) task_name,sum(budget) budget,sum(earned) earned,sum(actual) actual,
   bool_or(overrun_qty>0) overrun,bool_or(problem IS NOT NULL) broken,count(*) links FROM scalc GROUP BY 1,2,3)
 SELECT jsonb_build_object(
  'status','ok','link_set_version',s.version,
  'links',coalesce((SELECT jsonb_agg(jsonb_build_object('link_id',link_id,'boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'unit_kind',unit_kind,'unit_label',unit_label,
     'task_id',task_id,'code',code,'task_name',task_name,'share_pct',share_pct,'budget',budget,'allocated_qty',alloc_qty,'consumed_qty',consumed,'earned',earned,'actual',actual,
     'variance',earned-actual,'overrun_qty',overrun_qty,'mapped',module_id IS NOT NULL,'problem',problem) ORDER BY unit_kind,unit_label,code,sno) FROM calc),'[]'),
  'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'task_id',task_id,'code',code,'task_name',task_name,'budget',budget,'earned',earned,
     'actual',actual,'variance',earned-actual,'overrun',overrun,'broken',broken,'links',links) ORDER BY unit_kind,unit_label,code) FROM tasks),'[]'),
  'units',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',u.unit_kind,'unit_label',u.unit_label,'mapped',u.module_id IS NOT NULL,'mapped_by',u.mapped_by,
     'module_name',(SELECT name FROM public.modules WHERE id=u.module_id),'unmapped_reason',u.unmapped_reason,
     'modules_found',CASE WHEN u.module_id IS NULL THEN u.all_names ELSE '[]'::jsonb END,
     'budget',t.budget,'earned',t.earned,'actual',t.actual,'variance',t.earned-t.actual,'overrun',t.overrun) ORDER BY u.unit_kind,u.unit_label)
   FROM um u JOIN (SELECT unit_kind,unit_label,sum(budget) budget,sum(earned) earned,sum(actual) actual,bool_or(overrun) overrun FROM tasks GROUP BY 1,2) t USING (unit_kind,unit_label)),'[]'),
  'site_lines',coalesce((SELECT jsonb_agg(jsonb_build_object('boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'budget',budget,
     'note','Waiting for unit on site reports',
     'earned',coalesce((SELECT sum(c.earned) FROM scalc c WHERE c.boq_item_id=site.boq_item_id),0),
     'actual',coalesce((SELECT sum(c.actual) FROM scalc c WHERE c.boq_item_id=site.boq_item_id),0),
     'site_unassigned_qty',coalesce((SELECT sl.unassigned FROM sline sl WHERE sl.boq_item_id=site.boq_item_id),0),
     'problem',CASE WHEN (SELECT sl.stale FROM sline sl WHERE sl.boq_item_id=site.boq_item_id) THEN 'Unit split exceeds reported quantity' END) ORDER BY sno) FROM site),'[]'),
  'site_links',coalesce((SELECT jsonb_agg(jsonb_build_object('link_id',link_id,'boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'unit_kind',unit_kind,'unit_label',unit_label,
     'task_id',task_id,'code',code,'task_name',task_name,'share_pct',share_pct,'budget',budget,'allocated_qty',alloc_qty,'consumed_qty',consumed,'earned',earned,'actual',actual,
     'variance',earned-actual,'overrun_qty',overrun_qty,'problem',problem) ORDER BY unit_kind,unit_label,code,sno) FROM scalc),'[]'),
  'site_tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'task_id',task_id,'code',code,'task_name',task_name,'budget',budget,'earned',earned,
     'actual',actual,'variance',earned-actual,'overrun',overrun,'broken',broken,'links',links) ORDER BY unit_kind,unit_label,code) FROM stasks),'[]'),
  'site_units',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'budget',budget,'earned',earned,'actual',actual,'variance',earned-actual,'overrun',overrun)
     ORDER BY unit_kind,unit_label) FROM (SELECT unit_kind,unit_label,sum(budget) budget,sum(earned) earned,sum(actual) actual,bool_or(overrun) overrun FROM stasks GROUP BY 1,2) su),'[]'),
  'totals',jsonb_build_object('factory_budget',coalesce((SELECT sum(budget) FROM calc),0),'earned',coalesce((SELECT sum(earned) FROM calc),0),
     'actual',coalesce((SELECT sum(actual) FROM calc),0),'variance',coalesce((SELECT sum(earned-actual) FROM calc),0),
     'site_budget',coalesce((SELECT sum(budget) FROM site),0),'unmapped_units',(SELECT count(*) FROM um WHERE module_id IS NULL),
     'overrun_links',(SELECT count(*) FROM calc WHERE overrun_qty>0),'broken_links',(SELECT count(*) FROM calc WHERE problem IS NOT NULL),
     'site_earned',coalesce((SELECT sum(earned) FROM scalc),0),'site_actual',coalesce((SELECT sum(actual) FROM scalc),0),
     'site_unassigned_lines',(SELECT count(*) FROM sline WHERE unassigned>0 AND boq_item_id IN (SELECT boq_item_id FROM site))))
 INTO result;
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.boq3_task_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boq3_task_report(uuid) TO authenticated;