CREATE OR REPLACE FUNCTION public.can_view_site_overview(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _uid IS NOT NULL AND _uid=auth.uid()
 AND EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=_uid AND is_active)
 AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role::text=ANY(ARRAY[
 'managing_director','finance_director','sales_director','architecture_director','super_admin',
 'head_of_projects','planning_head','finance_manager','quantity_surveyor','costing_engineer',
 'site_installation_mgr','head_operations','production_head']))
$$;
REVOKE ALL ON FUNCTION public.can_view_site_overview(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_site_overview(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_site_overview(p_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_site_cost boolean; v_factory boolean; v_factory_cost boolean; v_result jsonb;
 -- Factory is expected Monday-Saturday. Sunday is the fixed weekly exception (ISO weekday 7).
 v_factory_rest_day CONSTANT integer:=7;
BEGIN
 IF NOT public.can_view_site_overview(v_uid) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_date IS NULL THEN RAISE EXCEPTION 'Choose a date' USING ERRCODE='22004'; END IF;
 v_site_cost:=public.can_view_running_bill(v_uid);
 v_factory:=public.can_read_factory(v_uid);
 v_factory_cost:=v_factory AND public.can_view_factory_cost(v_uid);
 WITH
 visible_projects AS(
  SELECT p.id,p.name FROM public.projects p
  WHERE NOT coalesce(p.is_archived,false) AND NOT coalesce(p.is_design_only,false)
   AND lower(p.status)='active'
   AND (public.is_tier1_or_super(v_uid) OR public.user_can_access_project(v_uid,p.id))
   AND (EXISTS(SELECT 1 FROM public.project_team_members tm JOIN public.profiles pr ON pr.id=tm.profile_id
     WHERE tm.project_id=p.id AND tm.is_active AND pr.is_active AND
      (tm.role IN('site_engineer','site_installation_mgr') OR EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=pr.auth_user_id AND ur.role::text IN('site_engineer','site_installation_mgr'))))
    OR EXISTS(SELECT 1 FROM public.daily_measurements d WHERE d.project_id=p.id AND d.trade='daily_site_report' AND NOT d.is_archived AND d.measurement_date BETWEEN p_date-6 AND p_date)
    OR EXISTS(SELECT 1 FROM public.labour_attendance a WHERE a.project_id=p.id AND a.work_date BETWEEN p_date-6 AND p_date))
 ),
 sr AS(SELECT d.* FROM public.daily_measurements d JOIN visible_projects p ON p.id=d.project_id
   WHERE d.trade='daily_site_report' AND NOT d.is_archived AND d.measurement_date=p_date),
 fr AS(SELECT * FROM public.factory_daily_reports WHERE v_factory AND report_date=p_date AND NOT is_archived),
 sa AS(SELECT a.project_id,a.worker_id,w.name,a.hours,
   CASE WHEN v_site_cost THEN round(a.hours*coalesce(c.hourly_rate,c.monthly_salary/208,0),2) END amount
  FROM public.labour_attendance a JOIN visible_projects p ON p.id=a.project_id JOIN public.labour_workers w ON w.id=a.worker_id
  LEFT JOIN public.labour_worker_compensation c ON c.worker_id=a.worker_id WHERE a.work_date=p_date AND a.hours>0),
 fa AS(SELECT a.worker_id,w.name,a.hours,CASE WHEN v_factory_cost THEN coalesce(a.amount,round(a.hours*a.effective_hourly_rate,2),0) END amount
  FROM public.factory_labour_attendance a JOIN public.labour_workers w ON w.id=a.worker_id
  WHERE v_factory AND a.work_date=p_date AND a.hours>0 AND NOT a.is_archived),
 site_tasks AS(
  SELECT DISTINCT sr.id report_id,sr.project_id,t.id task_id,t.task_id_in_schedule code,t.task_name name,
    coalesce(sp.completion_percentage_after,0) progress,sp.task_status status,sp.remarks,
    coalesce((SELECT sum(tw.hours) FROM public.site_report_task_workers tw WHERE tw.report_id=sr.id AND tw.task_id=t.id AND NOT tw.is_archived),
      (SELECT sum(l.hours) FROM public.site_report_labour l WHERE l.report_id=sr.id AND l.task_id=t.id),0) hours
  FROM sr JOIN public.project_tasks t ON t.project_id=sr.project_id
  LEFT JOIN public.site_report_task_progress sp ON sp.report_id=sr.id AND sp.task_id=t.id
  WHERE coalesce(sp.completion_percentage_after,0)>0 OR EXISTS(SELECT 1 FROM public.site_report_quantities q JOIN public.project_boq_items b ON b.id=q.boq_item_id WHERE q.report_id=sr.id AND b.schedule_task_id=t.id AND q.today_qty>0)
 ),
 factory_blocks AS(
  SELECT b.report_id,b.module_id,b.stage,b.progress_pct progress,b.stage_status status,b.remarks,m.module_code code,m.name,
   coalesce((SELECT sum(tw.hours) FROM public.factory_report_task_workers tw WHERE tw.report_id=b.report_id AND tw.module_id=b.module_id AND tw.stage=b.stage AND NOT tw.is_archived),0) hours
  FROM public.factory_report_blocks b JOIN fr ON fr.id=b.report_id JOIN public.modules m ON m.id=b.module_id WHERE NOT b.is_archived
   AND (b.progress_pct>0 OR EXISTS(SELECT 1 FROM public.factory_report_quantities q WHERE q.report_id=b.report_id AND q.module_id=b.module_id AND q.stage=b.stage AND NOT q.is_archived AND q.today_qty>0))
 ),
 site_rows AS(
  SELECT p.id key,CASE WHEN sr.report_status='submitted' THEN 2 WHEN sr.id IS NOT NULL THEN 1 ELSE 0 END sort,
   jsonb_build_object('kind','site','project_id',p.id,'name',p.name,'report_id',sr.id,
    'status',CASE WHEN sr.report_status='submitted' THEN 'Submitted' WHEN sr.id IS NOT NULL THEN 'Draft' ELSE 'Not started' END,
    'who',pr.display_name,'last_update',coalesce(sr.submitted_at,sr.updated_at),
    'activities',(SELECT count(DISTINCT task_id) FROM site_tasks st WHERE st.report_id=sr.id),
    'people',(SELECT count(DISTINCT worker_id) FROM sa WHERE project_id=p.id),
    'hours',coalesce((SELECT sum(hours) FROM sa WHERE project_id=p.id),0),
    'report',jsonb_build_object('notes',sr.notes,
      'activities',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'name',name,'stage',NULL,'progress',progress,'status',status,'remarks',remarks,'hours',hours) ORDER BY code) FROM site_tasks WHERE report_id=sr.id),'[]'::jsonb),
      'workers',coalesce((SELECT jsonb_agg(jsonb_build_object('name',name,'hours',hours) ORDER BY name) FROM sa WHERE project_id=p.id),'[]'::jsonb),
      'quantities',coalesce((SELECT jsonb_agg(jsonb_build_object('item',coalesce(b.item_description,q.extra_work_description),'qty',q.today_qty,'unit',coalesce(q.unit,b.unit)) ORDER BY b.sno,q.created_at) FROM public.site_report_quantities q LEFT JOIN public.project_boq_items b ON b.id=q.boq_item_id WHERE q.report_id=sr.id AND q.today_qty>0),'[]'::jsonb),
      'expenses',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',e.kind,'description',e.description) || CASE WHEN v_site_cost THEN jsonb_build_object('amount',e.amount_inr) ELSE '{}'::jsonb END) FROM public.site_report_expenses e WHERE e.report_id=sr.id AND NOT e.is_archived),'[]'::jsonb)
    )) || CASE WHEN v_site_cost THEN jsonb_build_object('cost',CASE WHEN sr.report_status='submitted' THEN
     jsonb_build_object('attendance',coalesce((SELECT sum(amount) FROM sa WHERE project_id=p.id),0),
      'subcontract',coalesce((SELECT sum(q.amount_inr) FROM public.site_report_quantities q WHERE q.report_id=sr.id AND q.contractor_id IS NOT NULL),0),
      'consumables',coalesce((SELECT sum(e.amount_inr) FROM public.site_report_expenses e WHERE e.report_id=sr.id AND NOT e.is_archived AND e.kind='consumable'),0),
      'expenses',coalesce((SELECT sum(e.amount_inr) FROM public.site_report_expenses e WHERE e.report_id=sr.id AND NOT e.is_archived AND e.kind='expense'),0))
     ELSE jsonb_build_object('attendance',0,'subcontract',0,'consumables',0,'expenses',0) END) ELSE '{}'::jsonb END data
  FROM visible_projects p LEFT JOIN sr ON sr.project_id=p.id
  LEFT JOIN public.profiles pr ON pr.auth_user_id=CASE WHEN sr.report_status='submitted' THEN sr.submitted_by ELSE coalesce(sr.updated_by,sr.created_by) END
 ),
 factory_row AS(
  SELECT NULL::uuid key,CASE WHEN fr.status='submitted' THEN 2 WHEN fr.id IS NOT NULL THEN 1 ELSE 0 END sort,
   jsonb_build_object('kind','factory','name','Factory','project_id',NULL,'report_id',fr.id,
    'expected',extract(isodow FROM p_date)<>v_factory_rest_day,
    'status',CASE WHEN fr.status='submitted' THEN 'Submitted' WHEN fr.id IS NOT NULL THEN 'Draft' ELSE 'Not started' END,
    'who',pr.display_name,'last_update',coalesce(fr.submitted_at,fr.updated_at),
    'activities',(SELECT count(DISTINCT (module_id,stage)) FROM factory_blocks),
    'people',(SELECT count(DISTINCT worker_id) FROM fa),'hours',coalesce((SELECT sum(hours) FROM fa),0),
    'report',jsonb_build_object('notes',fr.notes,
      'activities',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'name',name,'stage',stage,'progress',progress,'status',status,'remarks',remarks,'hours',hours) ORDER BY code,stage) FROM factory_blocks),'[]'::jsonb),
      'workers',coalesce((SELECT jsonb_agg(jsonb_build_object('name',name,'hours',hours) ORDER BY name) FROM fa),'[]'::jsonb),
      'quantities',coalesce((SELECT jsonb_agg(jsonb_build_object('item',b.item_description,'qty',q.today_qty,'unit',coalesce(q.unit,b.unit)) ORDER BY b.sno) FROM public.factory_report_quantities q JOIN public.project_boq_items b ON b.id=q.boq_item_id JOIN fr ON fr.id=q.report_id WHERE NOT q.is_archived AND q.today_qty>0),'[]'::jsonb),
      'expenses',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',e.kind,'description',e.description) || CASE WHEN v_factory_cost THEN jsonb_build_object('amount',e.amount_inr) ELSE '{}'::jsonb END) FROM public.factory_report_expenses e JOIN fr ON fr.id=e.report_id WHERE NOT e.is_archived),'[]'::jsonb)
    )) || CASE WHEN v_factory_cost THEN jsonb_build_object('cost',CASE WHEN fr.status='submitted' THEN
     jsonb_build_object('attendance',coalesce((SELECT sum(amount) FROM fa),0),
      'subcontract',coalesce((SELECT sum(q.amount_inr) FROM public.factory_report_quantities q WHERE q.report_id=fr.id AND NOT q.is_archived AND q.contractor_id IS NOT NULL),0),
      'consumables',coalesce((SELECT sum(e.amount_inr) FROM public.factory_report_expenses e WHERE e.report_id=fr.id AND NOT e.is_archived AND e.kind='consumable'),0),
      'expenses',coalesce((SELECT sum(e.amount_inr) FROM public.factory_report_expenses e WHERE e.report_id=fr.id AND NOT e.is_archived AND e.kind='expense'),0))
     ELSE jsonb_build_object('attendance',0,'subcontract',0,'consumables',0,'expenses',0) END) ELSE '{}'::jsonb END data
  FROM (SELECT 1) dummy LEFT JOIN fr ON true LEFT JOIN public.profiles pr ON pr.auth_user_id=CASE WHEN fr.status='submitted' THEN fr.submitted_by ELSE coalesce(fr.updated_by,fr.created_by) END WHERE v_factory
 ),
 rows AS(SELECT * FROM site_rows UNION ALL SELECT * FROM factory_row),
 feed AS(
  SELECT sr.submitted_at time,pr.display_name who,p.name location,'site' kind,p.id project_id,st.code,st.name,NULL::text stage,coalesce(st.hours,0) hours,
   coalesce((SELECT jsonb_agg(z.line) FROM(SELECT coalesce(b.item_description,q.extra_work_description)||' '||q.today_qty||' '||coalesce(q.unit,b.unit,'') line FROM public.site_report_quantities q LEFT JOIN public.project_boq_items b ON b.id=q.boq_item_id WHERE q.report_id=sr.id AND q.today_qty>0 AND (st.task_id IS NULL OR b.schedule_task_id=st.task_id) ORDER BY b.sno,q.created_at LIMIT 3)z),'[]'::jsonb) quantities
  FROM sr JOIN visible_projects p ON p.id=sr.project_id LEFT JOIN site_tasks st ON st.report_id=sr.id LEFT JOIN public.profiles pr ON pr.auth_user_id=sr.submitted_by WHERE sr.report_status='submitted'
  UNION ALL
  SELECT fr.submitted_at,pr.display_name,'Factory','factory',NULL,fb.code,fb.name,fb.stage,coalesce(fb.hours,0),
   coalesce((SELECT jsonb_agg(z.line) FROM(SELECT b.item_description||' '||q.today_qty||' '||coalesce(q.unit,b.unit,'') line FROM public.factory_report_quantities q JOIN public.project_boq_items b ON b.id=q.boq_item_id WHERE q.report_id=fr.id AND NOT q.is_archived AND q.today_qty>0 AND (fb.module_id IS NULL OR (q.module_id=fb.module_id AND q.stage=fb.stage)) ORDER BY b.sno,q.created_at LIMIT 3)z),'[]'::jsonb)
  FROM fr LEFT JOIN factory_blocks fb ON fb.report_id=fr.id LEFT JOIN public.profiles pr ON pr.auth_user_id=fr.submitted_by WHERE fr.status='submitted'
 )
 SELECT jsonb_build_object('date',p_date,
  'kpis',jsonb_build_object('sites_expected',(SELECT count(*) FROM visible_projects),
   'sites_submitted',(SELECT count(*) FROM site_rows WHERE sort=2),'sites_draft',(SELECT count(*) FROM site_rows WHERE sort=1),
   'factory_status',(SELECT data->>'status' FROM factory_row),
   'activities',(SELECT count(DISTINCT task_id) FROM site_tasks st JOIN sr ON sr.id=st.report_id WHERE sr.report_status='submitted')+(SELECT count(DISTINCT (module_id,stage)) FROM factory_blocks fb JOIN fr ON fr.id=fb.report_id WHERE fr.status='submitted'),
   'people_working',(SELECT count(DISTINCT worker_id) FROM(SELECT worker_id FROM sa UNION SELECT worker_id FROM fa)w),
   'labour_hours',coalesce((SELECT sum(hours) FROM sa),0)+coalesce((SELECT sum(hours) FROM fa),0)
  ) || CASE WHEN v_site_cost OR v_factory_cost THEN jsonb_build_object('cost',
     (CASE WHEN v_site_cost THEN jsonb_build_object('site',coalesce((SELECT sum((data->'cost'->>'attendance')::numeric+(data->'cost'->>'subcontract')::numeric+(data->'cost'->>'consumables')::numeric+(data->'cost'->>'expenses')::numeric) FROM site_rows),0)) ELSE '{}'::jsonb END)
     || (CASE WHEN v_factory_cost THEN jsonb_build_object('factory',coalesce((SELECT (data->'cost'->>'attendance')::numeric+(data->'cost'->>'subcontract')::numeric+(data->'cost'->>'consumables')::numeric+(data->'cost'->>'expenses')::numeric FROM factory_row),0)) ELSE '{}'::jsonb END)) ELSE '{}'::jsonb END,
  'sites',coalesce((SELECT jsonb_agg(data ORDER BY sort,data->>'name') FROM site_rows),'[]'::jsonb),
  'factory',(SELECT data FROM factory_row),
  'rows',coalesce((SELECT jsonb_agg(data ORDER BY sort,data->>'name') FROM rows),'[]'::jsonb),
  'feed',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY time DESC,location,code) FROM(SELECT * FROM feed ORDER BY time DESC,location,code LIMIT 30)f),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.get_site_overview(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_site_overview(date) TO authenticated;
COMMENT ON FUNCTION public.get_site_overview(date) IS 'Read-only daily office overview. Active non-design projects with active site members or site report/attendance in inclusive date-6..date. Factory expected Monday-Saturday. Costs are permitted aggregates, submitted reports only; no worker wages or rates.';
