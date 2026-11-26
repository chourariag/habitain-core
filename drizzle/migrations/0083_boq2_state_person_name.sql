CREATE OR REPLACE FUNCTION public._boq2_state(p_project uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h public.project_boq; s public.boq_link_sets; block text; result jsonb;
BEGIN
 SELECT * INTO h FROM public.project_boq WHERE project_id=p_project AND NOT is_archived ORDER BY version_number DESC,uploaded_at DESC,id DESC LIMIT 1;
 SELECT * INTO s FROM public.boq_link_sets WHERE project_id=p_project AND NOT is_archived;
 block:=CASE WHEN h.id IS NULL THEN 'This project has no BOQ yet.' WHEN h.entry_mode='fresh' AND h.status<>'final' THEN 'Finalise the fresh BOQ before linking it to tasks.' END;
 WITH lines AS (
  SELECT i.id,i.sno,i.item_description,i.unit,coalesce(i.boq_qty,0) qty,coalesce(i.boq_rate,0) rate,round(coalesce(i.boq_qty,0)*coalesce(i.boq_rate,0),2) value,i.schedule_task_id,ht.task_id_in_schedule hint_code,ht.task_name hint_name
  FROM public.project_boq_items i LEFT JOIN public.project_tasks ht ON ht.id=i.schedule_task_id WHERE i.boq_id=h.id AND NOT i.is_archived),
 units AS (SELECT * FROM public._boq2_units(p_project)),
 alloc AS (SELECT a.id,a.boq_item_id,a.unit_kind,a.unit_label,a.quantity,NOT EXISTS(SELECT 1 FROM units u WHERE u.unit_kind=a.unit_kind AND u.unit_label=a.unit_label) unit_missing
  FROM public.boq_unit_allocations a JOIN lines l ON l.id=a.boq_item_id WHERE a.link_set_id=s.id AND NOT a.is_archived),
 lk AS (SELECT k.id,k.boq_item_id,k.unit_kind,k.unit_label,k.task_id,k.share_pct,t.task_id_in_schedule code,t.task_name,
   coalesce(public._boq2_task_problem(k.task_id,p_project,k.unit_kind,k.unit_label),CASE WHEN a.id IS NULL OR a.quantity=0 THEN 'unit has no quantity for this line' END) problem,
   coalesce(a.quantity,0) uq,l.rate
  FROM public.boq_task_links k JOIN lines l ON l.id=k.boq_item_id LEFT JOIN public.project_tasks t ON t.id=k.task_id
  LEFT JOIN alloc a ON a.boq_item_id=k.boq_item_id AND a.unit_kind=k.unit_kind AND a.unit_label=k.unit_label
  WHERE k.link_set_id=s.id AND NOT k.is_archived),
 cum AS (SELECT lk.*,
   sum(CASE WHEN problem IS NULL THEN uq*rate*share_pct/100 ELSE 0 END) OVER (PARTITION BY boq_item_id ORDER BY unit_kind,unit_label,code NULLS LAST,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) running FROM lk),
 valued AS (SELECT cum.*,CASE WHEN problem IS NULL THEN round(running,2)-round(coalesce(lag(running) OVER (PARTITION BY boq_item_id ORDER BY unit_kind,unit_label,code NULLS LAST,id),0),2) ELSE 0 END budget FROM cum),
 unit_tot AS (SELECT boq_item_id,unit_kind,unit_label,coalesce(sum(share_pct) FILTER (WHERE problem IS NULL),0) share_total FROM lk GROUP BY 1,2,3),
 line_st AS (SELECT l.*,
   coalesce((SELECT sum(a.quantity) FROM alloc a WHERE a.boq_item_id=l.id),0) alloc_sum,
   (SELECT count(*) FROM alloc a WHERE a.boq_item_id=l.id) alloc_n,
   (SELECT count(*) FROM lk WHERE lk.boq_item_id=l.id) link_n,
   (SELECT count(*) FROM lk WHERE lk.boq_item_id=l.id AND lk.problem IS NOT NULL)+(SELECT count(*) FROM alloc a WHERE a.boq_item_id=l.id AND a.unit_missing AND a.quantity>0) broken_n,
   EXISTS(SELECT 1 FROM alloc a LEFT JOIN unit_tot u ON u.boq_item_id=a.boq_item_id AND u.unit_kind=a.unit_kind AND u.unit_label=a.unit_label WHERE a.boq_item_id=l.id AND a.quantity>0 AND coalesce(u.share_total,0)<>100) shares_short,
   coalesce((SELECT sum(v.budget) FROM valued v WHERE v.boq_item_id=l.id),0) linked
  FROM lines l),
 st AS (SELECT line_st.*,CASE WHEN qty=0 THEN 'skipped' WHEN broken_n>0 THEN 'broken' WHEN alloc_n=0 AND link_n=0 THEN 'not_started' WHEN alloc_sum<>qty THEN 'split_incomplete' WHEN shares_short THEN 'shares_incomplete' ELSE 'complete' END status FROM line_st),
 tot AS (SELECT coalesce(sum(value) FILTER (WHERE qty<>0),0) boq_total,coalesce(sum(linked),0) linked,count(*) FILTER (WHERE qty<>0) needed,count(*) FILTER (WHERE status='complete') complete,count(*) FILTER (WHERE status='broken') broken,count(*) FILTER (WHERE qty=0) skipped FROM st)
 SELECT jsonb_build_object(
  'boq',CASE WHEN h.id IS NULL THEN NULL ELSE jsonb_build_object('id',h.id,'entry_mode',h.entry_mode,'status',h.status,'version_number',h.version_number) END,
  'blocked_reason',block,
  'set',CASE WHEN s.id IS NULL THEN jsonb_build_object('status','draft','version',0) ELSE jsonb_build_object('id',s.id,'status',s.status,'version',s.version,'locked_at',s.locked_at,'locked_by',s.locked_by,'locked_by_name',(SELECT display_name FROM public.profiles WHERE auth_user_id=s.locked_by LIMIT 1),'rules_source',s.rules_source) END,
  'totals',(SELECT jsonb_build_object('boq_total',boq_total,'linked',linked,'unlinked',boq_total-linked,'lines_needed',needed,'lines_complete',complete,'lines_broken',broken,'lines_skipped',skipped) FROM tot),
  'coverage_reason',(SELECT CASE WHEN block IS NOT NULL THEN block WHEN needed=0 THEN 'There are no BOQ lines with quantity to link.' WHEN broken>0 THEN broken||' line(s) have broken links to fix.' WHEN complete<needed THEN (needed-complete)||' of '||needed||' line(s) are not fully split and shared.' WHEN linked<>boq_total THEN 'Linked value does not match the BOQ total.' END FROM tot),
  'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',st.id,'sno',st.sno,'description',st.item_description,'unit',st.unit,'qty',st.qty,'rate',st.rate,'value',st.value,'linked',st.linked,'allocated',st.alloc_sum,'status',st.status,
     'legacy_task_hint',CASE WHEN st.schedule_task_id IS NULL THEN NULL ELSE btrim(coalesce(st.hint_code,'')||' '||coalesce(st.hint_name,'')) END,
     'allocations',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',a.unit_kind,'unit_label',a.unit_label,'quantity',a.quantity,'unit_missing',a.unit_missing,'share_total',coalesce(u.share_total,0)) ORDER BY a.unit_kind,a.unit_label) FROM alloc a LEFT JOIN unit_tot u ON u.boq_item_id=a.boq_item_id AND u.unit_kind=a.unit_kind AND u.unit_label=a.unit_label WHERE a.boq_item_id=st.id),'[]'),
     'links',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'unit_kind',v.unit_kind,'unit_label',v.unit_label,'task_id',v.task_id,'code',v.code,'task_name',v.task_name,'share_pct',v.share_pct,'budget',v.budget,'problem',v.problem) ORDER BY v.unit_kind,v.unit_label,v.code) FROM valued v WHERE v.boq_item_id=st.id),'[]')) ORDER BY st.sno) FROM st),'[]'),
  'broken',coalesce((SELECT jsonb_agg(b.x ORDER BY b.x->>'sno') FROM (SELECT jsonb_build_object('sno',l.sno,'description',l.item_description,'unit_kind',lk.unit_kind,'unit_label',lk.unit_label,'code',lk.code,'reason',lk.problem) x FROM lk JOIN lines l ON l.id=lk.boq_item_id WHERE lk.problem IS NOT NULL
     UNION ALL SELECT jsonb_build_object('sno',l.sno,'description',l.item_description,'unit_kind',a.unit_kind,'unit_label',a.unit_label,'code',NULL,'reason','unit is no longer in the schedule') FROM alloc a JOIN lines l ON l.id=a.boq_item_id WHERE a.unit_missing AND a.quantity>0) b),'[]'),
  'task_budgets',coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',tb.task_id,'code',tb.code,'task_name',tb.task_name,'unit_kind',tb.unit_kind,'unit_label',tb.unit_label,'budget',tb.budget,'lines',tb.n) ORDER BY tb.unit_kind,tb.unit_label,tb.code) FROM (SELECT task_id,code,task_name,unit_kind,unit_label,sum(budget) budget,count(DISTINCT boq_item_id) n FROM valued WHERE problem IS NULL GROUP BY 1,2,3,4,5) tb),'[]'),
  'unit_budgets',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',ub.unit_kind,'unit_label',ub.unit_label,'budget',ub.budget) ORDER BY ub.unit_kind,ub.unit_label) FROM (SELECT unit_kind,unit_label,sum(budget) budget FROM valued WHERE problem IS NULL GROUP BY 1,2) ub),'[]'),
  'units',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',un.unit_kind,'unit_label',un.unit_label) ORDER BY un.unit_kind,un.unit_label) FROM units un),'[]'),
  'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'code',t.task_id_in_schedule,'task_name',t.task_name,'unit_kind',t.unit_kind,'unit_label',t.unit_label,'library_task_id',t.library_task_id) ORDER BY t.unit_kind,t.unit_label,t.task_id_in_schedule) FROM public.project_tasks t WHERE t.project_id=p_project AND NOT coalesce(t.is_removed,false) AND t.task_type::text='task' AND NOT coalesce(t.is_qc_gate,false) AND NOT coalesce(t.is_payment_milestone,false) AND t.unit_kind IS NOT NULL AND t.unit_label IS NOT NULL),'[]'),
  'audit',coalesce((SELECT jsonb_agg(jsonb_build_object('id',au.id,'action',au.action,'reason',au.reason,'boq_item_id',au.boq_item_id,'old_value',au.old_value,'new_value',au.new_value,'created_at',au.created_at,'actor',coalesce(pr.display_name,'Unknown')) ORDER BY au.created_at DESC) FROM (SELECT * FROM public.boq_link_audit WHERE project_id=p_project ORDER BY created_at DESC LIMIT 100) au LEFT JOIN public.profiles pr ON pr.auth_user_id=au.created_by),'[]'))
 INTO result FROM (SELECT 1) one;
 RETURN result || jsonb_build_object('can_lock',(result->'set'->>'status')='draft' AND result->>'coverage_reason' IS NULL,
  'lock_reason',CASE WHEN (result->'set'->>'status')='locked' THEN 'Links are already locked.' ELSE result->>'coverage_reason' END,
  'revision_needed',(result->'set'->>'status')='locked' AND result->>'coverage_reason' IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public._boq2_state(uuid) FROM PUBLIC, anon, authenticated;