CREATE FUNCTION public.get_cost_report(p_project_id uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; bill jsonb; factory jsonb; person_cost boolean;
BEGIN
 IF NOT public.can_view_running_bill(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to view project costs' USING ERRCODE='42501'; END IF;
 IF p_project_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id) THEN RAISE EXCEPTION 'Project not found'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Choose a valid date range'; END IF;
 person_cost:=public.can_access_labour_compensation(auth.uid());
 bill:=public.get_running_bill(p_project_id,p_to);
 WITH
 sr AS(SELECT id,measurement_date d FROM public.daily_measurements WHERE project_id=p_project_id AND trade='daily_site_report' AND report_status='submitted' AND NOT coalesce(is_archived,false) AND measurement_date BETWEEN p_from AND p_to),
 fr AS(SELECT id,report_date d FROM public.factory_daily_reports WHERE status='submitted' AND NOT is_archived AND report_date BETWEEN p_from AND p_to),
 att AS(SELECT a.worker_id,a.work_date d,a.hours,round(a.hours*coalesce(c.hourly_rate,c.monthly_salary/208,0),2) amount FROM public.labour_attendance a JOIN public.labour_workers w ON w.id=a.worker_id LEFT JOIN public.labour_worker_compensation c ON c.worker_id=a.worker_id WHERE a.project_id=p_project_id AND a.hours>0 AND a.work_date IN(SELECT d FROM sr)),
 exact_days AS(SELECT DISTINCT sr.d FROM sr JOIN public.site_report_task_workers tw ON tw.report_id=sr.id),
 exact_alloc AS(SELECT tw.task_id,a.d,a.worker_id,tw.hours hours,a.amount/a.hours*tw.hours amount FROM public.site_report_task_workers tw JOIN sr ON sr.id=tw.report_id JOIN att a ON a.d=sr.d AND a.worker_id=tw.worker_id WHERE NOT tw.is_archived),
 th AS(SELECT sr.d,l.task_id,sum(l.hours) h FROM public.site_report_labour l JOIN sr ON sr.id=l.report_id WHERE l.hours>0 AND sr.d NOT IN(SELECT d FROM exact_days) GROUP BY 1,2),
 tht AS(SELECT d,sum(h) h FROM th GROUP BY d),
 sa AS(
 SELECT task_id,d,worker_id,hours,amount,'Exact'::text allocation FROM exact_alloc
 UNION ALL SELECT NULL,a.d,a.worker_id,greatest(a.hours-coalesce(x.h,0),0),greatest(a.amount-coalesce(x.amount,0),0),'Exact' FROM att a LEFT JOIN(SELECT d,worker_id,sum(hours) h,sum(amount) amount FROM exact_alloc GROUP BY 1,2) x USING(d,worker_id) WHERE a.d IN(SELECT d FROM exact_days) AND a.hours>coalesce(x.h,0)
 UNION ALL SELECT th.task_id,a.d,a.worker_id,a.hours*th.h/tht.h,a.amount*th.h/tht.h,'Approximate' FROM att a JOIN th ON th.d=a.d JOIN tht ON tht.d=a.d
 UNION ALL SELECT NULL,a.d,a.worker_id,a.hours,a.amount,'Approximate' FROM att a WHERE a.d NOT IN(SELECT d FROM exact_days) AND a.d NOT IN(SELECT d FROM tht)),
 fa AS(SELECT tw.module_id,fr.d,tw.worker_id,tw.hours,tw.hours*a.effective_hourly_rate amount FROM public.factory_report_task_workers tw JOIN fr ON fr.id=tw.report_id JOIN public.modules m ON m.id=tw.module_id JOIN public.factory_labour_attendance a ON a.worker_id=tw.worker_id AND a.work_date=fr.d WHERE m.project_id=p_project_id AND NOT tw.is_archived),
 q AS(
 SELECT 'Site'::text location,sr.d,b.schedule_task_id group_id,q.today_qty,q.contractor_id,q.amount_inr,q.material_rate_used,q.material_amount_inr,q.material_rate_missing,coalesce(b.boq_rate,0) boq_rate FROM public.site_report_quantities q JOIN sr ON sr.id=q.report_id LEFT JOIN public.project_boq_items b ON b.id=q.boq_item_id
 UNION ALL SELECT 'Factory',fr.d,q.module_id,q.today_qty,q.contractor_id,q.amount_inr,q.material_rate_used,q.material_amount_inr,q.material_rate_missing,coalesce(b.boq_rate,0) FROM public.factory_report_quantities q JOIN fr ON fr.id=q.report_id JOIN public.modules m ON m.id=q.module_id LEFT JOIN public.project_boq_items b ON b.id=q.boq_item_id WHERE m.project_id=p_project_id AND NOT q.is_archived),
 qe AS(SELECT *,material_rate_used IS NOT NULL AND NOT coalesce(material_rate_missing=false AND material_amount_inr=0,false) AND abs(material_amount_inr-today_qty*material_rate_used)>0.005 corrected FROM q),
 ex AS(SELECT 'Site'::text location,sr.d,NULL::uuid group_id,e.kind,e.amount_inr FROM public.site_report_expenses e JOIN sr ON sr.id=e.report_id WHERE NOT e.is_archived UNION ALL SELECT 'Factory',fr.d,e.module_id,e.kind,e.amount_inr FROM public.factory_report_expenses e JOIN fr ON fr.id=e.report_id JOIN public.modules m ON m.id=e.module_id WHERE m.project_id=p_project_id AND NOT e.is_archived),
 parts AS(
 SELECT 'Site'::text location,a.d,NULL::uuid group_id,a.amount own_labour,0::numeric factory_labour,0::numeric subcontract,0::numeric material,0::numeric consumables,0::numeric expenses FROM att a
 UNION ALL SELECT 'Factory',d,module_id,0,amount,0,0,0,0 FROM fa
 UNION ALL SELECT location,d,group_id,0,0,CASE WHEN contractor_id IS NOT NULL AND today_qty>0 THEN coalesce(amount_inr,0) ELSE 0 END,coalesce(material_amount_inr,0),0,0 FROM q
 UNION ALL SELECT location,d,group_id,0,0,0,0,CASE WHEN kind='consumable' THEN amount_inr ELSE 0 END,CASE WHEN kind='expense' THEN amount_inr ELSE 0 END FROM ex),
 dates AS(SELECT d FROM sr UNION SELECT fr.d FROM public.factory_report_blocks b JOIN fr ON fr.id=b.report_id JOIN public.modules m ON m.id=b.module_id WHERE m.project_id=p_project_id AND NOT b.is_archived UNION SELECT d FROM fa UNION SELECT d FROM q UNION SELECT d FROM ex),
 day_parts AS(SELECT dates.d work_date,coalesce(sum(p.own_labour),0) own_labour,coalesce(sum(p.factory_labour),0) factory_labour,coalesce(sum(p.subcontract),0) subcontract,coalesce(sum(p.material),0) material,coalesce(sum(p.consumables),0) consumables,coalesce(sum(p.expenses),0) expenses FROM dates LEFT JOIN parts p ON p.d=dates.d GROUP BY dates.d),
 day_total AS(SELECT *,consumables+expenses consumables_expenses,own_labour+factory_labour+subcontract+material+consumables+expenses total FROM day_parts),
 days AS(SELECT *,sum(total) OVER(ORDER BY work_date) cumulative FROM day_total),
 group_parts AS(
 SELECT 'Site'::text location,task_id group_id,hours,amount labour_cost,allocation,0::numeric subcontract,0::numeric material,0::numeric consumables,0::numeric expenses FROM sa
 UNION ALL SELECT 'Factory',module_id,hours,amount,'Exact',0,0,0,0 FROM fa
 UNION ALL SELECT location,group_id,0,0,NULL,CASE WHEN contractor_id IS NOT NULL AND today_qty>0 THEN coalesce(amount_inr,0) ELSE 0 END,coalesce(material_amount_inr,0),0,0 FROM q
 UNION ALL SELECT location,group_id,0,0,NULL,0,0,CASE WHEN kind='consumable' THEN amount_inr ELSE 0 END,CASE WHEN kind='expense' THEN amount_inr ELSE 0 END FROM ex),
 gp AS(SELECT location,group_id,sum(hours) hours,sum(labour_cost) labour_cost,CASE WHEN bool_or(allocation='Approximate') THEN 'Approximate' ELSE 'Exact' END allocation,sum(subcontract) subcontract,sum(material) material,sum(consumables) consumables,sum(expenses) expenses FROM group_parts GROUP BY 1,2),
 workers_raw AS(SELECT 'Site'::text location,task_id group_id,worker_id,hours,amount,allocation FROM sa UNION ALL SELECT 'Factory',module_id,worker_id,hours,amount,'Exact' FROM fa),
 workers AS(SELECT location,group_id,worker_id,sum(hours) hours,sum(amount) amount,CASE WHEN bool_or(allocation='Approximate') THEN 'Approximate' ELSE 'Exact' END allocation FROM workers_raw GROUP BY 1,2,3),
 groups AS(SELECT gp.location,gp.group_id,coalesce(CASE WHEN gp.location='Site' THEN t.task_id_in_schedule ELSE m.module_code END,'') code,coalesce(CASE WHEN gp.location='Site' THEN t.task_name ELSE m.name END,'Project level') name,gp.hours,gp.labour_cost,gp.allocation,gp.subcontract,gp.material,gp.consumables,gp.expenses,gp.consumables+gp.expenses consumables_expenses,gp.labour_cost+gp.subcontract+gp.material+gp.consumables+gp.expenses total,
 coalesce((SELECT jsonb_agg(jsonb_build_object('worker_id',w.worker_id,'name',lw.name,'hours',w.hours,'allocation',w.allocation)||CASE WHEN person_cost THEN jsonb_build_object('amount',w.amount) ELSE '{}'::jsonb END ORDER BY lw.name,w.worker_id) FROM workers w JOIN public.labour_workers lw ON lw.id=w.worker_id WHERE w.location=gp.location AND w.group_id IS NOT DISTINCT FROM gp.group_id),'[]'::jsonb) workers
 FROM gp LEFT JOIN public.project_tasks t ON gp.location='Site' AND t.id=gp.group_id LEFT JOIN public.modules m ON gp.location='Factory' AND m.id=gp.group_id),
 totals AS(SELECT coalesce(sum(own_labour),0) own_labour,coalesce(sum(factory_labour),0) factory_labour,coalesce(sum(subcontract),0) subcontract,coalesce(sum(material),0) material,coalesce(sum(consumables),0) consumables,coalesce(sum(expenses),0) expenses,coalesce(sum(consumables_expenses),0) consumables_expenses,coalesce(sum(total),0) total FROM days),
 material_status AS(SELECT count(*) FILTER(WHERE material_rate_missing=true) missing_count,coalesce(sum(today_qty*boq_rate) FILTER(WHERE material_rate_missing=true),0) missing_boq_value,count(*) FILTER(WHERE material_rate_missing IS NULL) not_captured_count,count(*) FILTER(WHERE corrected) correction_count,coalesce(sum(today_qty*material_rate_used-material_amount_inr) FILTER(WHERE corrected),0) correction_difference,count(*) FILTER(WHERE corrected AND location='Site') site_correction_count,coalesce(sum(today_qty*material_rate_used-material_amount_inr) FILTER(WHERE corrected AND location='Site'),0) site_correction_difference,count(*) FILTER(WHERE corrected AND location='Factory') factory_correction_count,coalesce(sum(today_qty*material_rate_used-material_amount_inr) FILTER(WHERE corrected AND location='Factory'),0) factory_correction_difference FROM qe)
 SELECT jsonb_build_object('project_id',p_project_id,'from',p_from,'to',p_to,'can_view_person_cost',person_cost,'days',coalesce((SELECT jsonb_agg(to_jsonb(days) ORDER BY work_date) FROM days),'[]'::jsonb),'groups',coalesce((SELECT jsonb_agg(to_jsonb(groups) ORDER BY location,code,name) FROM groups),'[]'::jsonb),'material_status',(SELECT to_jsonb(material_status) FROM material_status),'totals',(SELECT to_jsonb(totals)||jsonb_build_object('value_earned',(bill->'totals'->>'value_earned')::numeric,'excess_value',(bill->'totals'->>'excess_value')::numeric,'value_minus_cost',(bill->'totals'->>'value_earned')::numeric-total) FROM totals)) INTO result;
 IF public.can_view_factory_cost(auth.uid()) THEN
  factory:=public.get_factory_cost(p_from,p_to);
  result:=result||jsonb_build_object('factory_unallocated',factory->'unallocated');
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_cost_report(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_cost_report(uuid,date,date) TO authenticated;
COMMENT ON FUNCTION public.get_cost_report(uuid,date,date) IS 'Read-only indicative submitted-report costs. Frozen material is never recalculated; zero captured amount with missing=false identifies historical includes-material rows without relying on mutable current rates. Per-worker amounts require can_access_labour_compensation.';