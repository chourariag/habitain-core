CREATE OR REPLACE FUNCTION public.boq3_task_report(p_project uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
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
 umap AS (SELECT u.unit_kind,u.unit_label,m.ids,
   (SELECT coalesce(jsonb_agg(mo.name ORDER BY mo.name),'[]') FROM public.modules mo WHERE mo.project_id=p_project AND NOT mo.is_archived) all_names
  FROM units u LEFT JOIN LATERAL (SELECT array_agg(mo.id) ids FROM public.modules mo WHERE mo.project_id=p_project AND NOT mo.is_archived AND u.unit_kind='module'
    AND (lower(btrim(coalesce(mo.name,'')))=lower(btrim(u.unit_label)) OR lower(btrim(coalesce(mo.module_code,'')))=lower(btrim(u.unit_label)))) m ON true),
 um AS (SELECT unit_kind,unit_label,CASE WHEN coalesce(cardinality(ids),0)=1 THEN ids[1] END module_id,
   CASE WHEN unit_kind<>'module' THEN 'Not a module unit' WHEN coalesce(cardinality(ids),0)=0 THEN 'No module matches this unit label' WHEN cardinality(ids)>1 THEN 'More than one module matches this unit label' END unmapped_reason,
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
 site AS (SELECT boq_item_id,min(sno) sno,max(description) description,max(uom) uom,sum(budget) budget FROM lk WHERE loc<>'factory' GROUP BY 1)
 SELECT jsonb_build_object(
  'status','ok','link_set_version',s.version,
  'links',coalesce((SELECT jsonb_agg(jsonb_build_object('link_id',link_id,'boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'unit_kind',unit_kind,'unit_label',unit_label,
     'task_id',task_id,'code',code,'task_name',task_name,'share_pct',share_pct,'budget',budget,'allocated_qty',alloc_qty,'consumed_qty',consumed,'earned',earned,'actual',actual,
     'variance',earned-actual,'overrun_qty',overrun_qty,'mapped',module_id IS NOT NULL,'problem',problem) ORDER BY unit_kind,unit_label,code,sno) FROM calc),'[]'),
  'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'task_id',task_id,'code',code,'task_name',task_name,'budget',budget,'earned',earned,
     'actual',actual,'variance',earned-actual,'overrun',overrun,'broken',broken,'links',links) ORDER BY unit_kind,unit_label,code) FROM tasks),'[]'),
  'units',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',u.unit_kind,'unit_label',u.unit_label,'mapped',u.module_id IS NOT NULL,
     'module_name',(SELECT name FROM public.modules WHERE id=u.module_id),'unmapped_reason',u.unmapped_reason,
     'modules_found',CASE WHEN u.module_id IS NULL THEN u.all_names ELSE '[]'::jsonb END,
     'budget',t.budget,'earned',t.earned,'actual',t.actual,'variance',t.earned-t.actual,'overrun',t.overrun) ORDER BY u.unit_kind,u.unit_label)
   FROM um u JOIN (SELECT unit_kind,unit_label,sum(budget) budget,sum(earned) earned,sum(actual) actual,bool_or(overrun) overrun FROM tasks GROUP BY 1,2) t USING (unit_kind,unit_label)),'[]'),
  'site_lines',coalesce((SELECT jsonb_agg(jsonb_build_object('boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'budget',budget,
     'note','Waiting for unit on site reports') ORDER BY sno) FROM site),'[]'),
  'totals',jsonb_build_object('factory_budget',coalesce((SELECT sum(budget) FROM calc),0),'earned',coalesce((SELECT sum(earned) FROM calc),0),
     'actual',coalesce((SELECT sum(actual) FROM calc),0),'variance',coalesce((SELECT sum(earned-actual) FROM calc),0),
     'site_budget',coalesce((SELECT sum(budget) FROM site),0),'unmapped_units',(SELECT count(*) FROM um WHERE module_id IS NULL),
     'overrun_links',(SELECT count(*) FROM calc WHERE overrun_qty>0),'broken_links',(SELECT count(*) FROM calc WHERE problem IS NOT NULL)))
 INTO result;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.boq3_task_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boq3_task_report(uuid) TO authenticated;