CREATE TABLE public.site_report_task_workers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),report_id uuid NOT NULL REFERENCES public.daily_measurements(id),project_id uuid NOT NULL REFERENCES public.projects(id),task_id uuid NOT NULL REFERENCES public.project_tasks(id),worker_id uuid NOT NULL REFERENCES public.labour_workers(id),hours numeric NOT NULL CHECK(hours>0 AND hours<=16),is_archived boolean NOT NULL DEFAULT false,created_by uuid NOT NULL,updated_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(report_id,task_id,worker_id));
GRANT SELECT ON public.site_report_task_workers TO authenticated;
GRANT ALL ON public.site_report_task_workers TO service_role;
ALTER TABLE public.site_report_task_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_workers_project_read ON public.site_report_task_workers FOR SELECT TO authenticated USING(public.user_can_access_project(auth.uid(),project_id));
CREATE INDEX task_workers_report ON public.site_report_task_workers(report_id);
CREATE TABLE public.site_report_expenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),report_id uuid NOT NULL REFERENCES public.daily_measurements(id),project_id uuid NOT NULL REFERENCES public.projects(id),kind text NOT NULL CHECK(kind IN ('consumable','expense')),description text NOT NULL CHECK(length(btrim(description))>0),amount_inr numeric NOT NULL CHECK(amount_inr>=0 AND amount_inr<>'NaN'::numeric),is_archived boolean NOT NULL DEFAULT false,created_by uuid NOT NULL,updated_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.site_report_expenses TO authenticated;
GRANT ALL ON public.site_report_expenses TO service_role;
ALTER TABLE public.site_report_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_project_read ON public.site_report_expenses FOR SELECT TO authenticated USING(public.user_can_access_project(auth.uid(),project_id));
CREATE INDEX report_expenses_report ON public.site_report_expenses(report_id);
ALTER TABLE public.site_report_task_progress ADD COLUMN task_status text NOT NULL DEFAULT 'ongoing' CHECK(task_status IN ('ongoing','completed'));
CREATE FUNCTION public._site_report_validate_task_workers(p_report_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.daily_measurements%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.daily_measurements WHERE id=p_report_id;
 PERFORM 1 FROM public.labour_attendance WHERE project_id=r.project_id AND work_date=r.measurement_date FOR SHARE;
 IF EXISTS(SELECT 1 FROM public.site_report_task_workers tw WHERE tw.report_id=r.id AND NOT tw.is_archived AND NOT EXISTS(SELECT 1 FROM public.labour_attendance a WHERE a.worker_id=tw.worker_id AND a.project_id=r.project_id AND a.work_date=r.measurement_date AND a.hours>0)) THEN RAISE EXCEPTION 'Worker must be present on this project and date.'; END IF;
 IF EXISTS(SELECT 1 FROM public.site_report_task_workers tw JOIN public.labour_attendance a ON a.worker_id=tw.worker_id AND a.project_id=r.project_id AND a.work_date=r.measurement_date WHERE tw.report_id=r.id AND NOT tw.is_archived GROUP BY tw.worker_id,a.hours HAVING sum(tw.hours)>a.hours) THEN RAISE EXCEPTION 'Worker allocated hours exceed attendance hours.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public._site_report_validate_task_workers(uuid) FROM PUBLIC,anon,authenticated;
DO $patch$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('public.save_site_report_draft(uuid,date,jsonb)'::regprocedure);
 IF position('  RETURN r.id;' IN d)=0 THEN RAISE EXCEPTION 'Save anchor missing'; END IF;
 d:=replace(d,'  RETURN r.id;',$new$
  IF p_payload ? 'task_workers' THEN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'task_workers') x GROUP BY x->>'task_id',x->>'worker_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Worker already selected for this task.'; END IF;
    FOR v_tid IN SELECT DISTINCT tid FROM (SELECT (x->>'task_id')::uuid tid FROM jsonb_array_elements(p_payload->'task_workers') x UNION SELECT value::uuid FROM jsonb_array_elements_text(coalesce(p_payload->'task_worker_task_ids','[]'))) ids LOOP
      IF NOT EXISTS(SELECT 1 FROM public.project_tasks WHERE id=v_tid AND project_id=p_project_id AND work_category='construction') THEN RAISE EXCEPTION 'Task not in this project'; END IF;
      SELECT coalesce(jsonb_agg(jsonb_build_object('worker_id',worker_id,'hours',hours) ORDER BY worker_id),'[]')::text INTO v_old FROM public.site_report_task_workers WHERE report_id=r.id AND task_id=v_tid AND NOT is_archived;
      UPDATE public.site_report_task_workers SET is_archived=true,updated_by=auth.uid(),updated_at=now() WHERE report_id=r.id AND task_id=v_tid AND NOT is_archived;
      FOR e IN SELECT value FROM jsonb_array_elements(p_payload->'task_workers') WHERE (value->>'task_id')::uuid=v_tid LOOP
        INSERT INTO public.site_report_task_workers(report_id,project_id,task_id,worker_id,hours,created_by,updated_by) VALUES(r.id,p_project_id,v_tid,(e->>'worker_id')::uuid,(e->>'hours')::numeric,auth.uid(),auth.uid()) ON CONFLICT(report_id,task_id,worker_id) DO UPDATE SET hours=excluded.hours,is_archived=false,updated_by=auth.uid(),updated_at=now();
      END LOOP;
      SELECT coalesce(jsonb_agg(jsonb_build_object('worker_id',worker_id,'hours',hours) ORDER BY worker_id),'[]')::text INTO v_new FROM public.site_report_task_workers WHERE report_id=r.id AND task_id=v_tid AND NOT is_archived;
      IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'task_workers:'||v_tid,v_old,v_new); END IF;
      SELECT hours::text INTO v_old FROM public.site_report_labour WHERE report_id=r.id AND task_id=v_tid;
      SELECT coalesce(sum(hours),0)::text INTO v_new FROM public.site_report_task_workers WHERE report_id=r.id AND task_id=v_tid AND NOT is_archived;
      IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'labour_hours:'||v_tid,v_old,v_new); END IF;
      INSERT INTO public.site_report_labour(report_id,project_id,task_id,hours,created_by,updated_by) VALUES(r.id,p_project_id,v_tid,v_new::numeric,auth.uid(),auth.uid()) ON CONFLICT(report_id,task_id) DO UPDATE SET hours=excluded.hours,updated_by=auth.uid(),updated_at=now();
    END LOOP;
  END IF;
  FOR v_tid IN SELECT DISTINCT task_id FROM public.site_report_task_workers WHERE report_id=r.id LOOP
    UPDATE public.site_report_labour SET hours=(SELECT coalesce(sum(hours),0) FROM public.site_report_task_workers WHERE report_id=r.id AND task_id=v_tid AND NOT is_archived),updated_by=auth.uid(),updated_at=now() WHERE report_id=r.id AND task_id=v_tid;
  END LOOP;
  PERFORM public._site_report_validate_task_workers(r.id);
  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'progress','[]')) LOOP
    v_tid:=(e->>'task_id')::uuid;
    IF e ? 'task_status' THEN
      SELECT task_status INTO v_old FROM public.site_report_task_progress WHERE report_id=r.id AND task_id=v_tid; v_new:=e->>'task_status';
      IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'task_status:'||v_tid,v_old,v_new); END IF;
      UPDATE public.site_report_task_progress SET task_status=v_new,updated_by=auth.uid(),updated_at=now() WHERE report_id=r.id AND task_id=v_tid;
    END IF;
  END LOOP;
  INSERT INTO public.site_report_task_progress(report_id,project_id,task_id,created_by,updated_by) SELECT r.id,p_project_id,tid,auth.uid(),auth.uid() FROM (SELECT b.schedule_task_id tid FROM public.site_report_quantities q JOIN public.project_boq_items b ON b.id=q.boq_item_id WHERE q.report_id=r.id AND q.today_qty>0 AND b.schedule_task_id IS NOT NULL UNION SELECT task_id FROM public.site_report_task_workers WHERE report_id=r.id AND NOT is_archived) t ON CONFLICT(report_id,task_id) DO NOTHING;
  IF p_payload ? 'expenses' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'description',description,'amount_inr',amount_inr) ORDER BY id),'[]')::text INTO v_old FROM public.site_report_expenses WHERE report_id=r.id AND NOT is_archived;
    v_keep:=ARRAY[]::uuid[];
    FOR e IN SELECT value FROM jsonb_array_elements(p_payload->'expenses') LOOP
      v_id:=coalesce(nullif(e->>'id','')::uuid,gen_random_uuid());
      IF v_id=ANY(v_keep) THEN RAISE EXCEPTION 'Duplicate expense row'; END IF;
      IF EXISTS(SELECT 1 FROM public.site_report_expenses WHERE id=v_id AND report_id<>r.id) THEN RAISE EXCEPTION 'Expense not in this report'; END IF;
      INSERT INTO public.site_report_expenses(id,report_id,project_id,kind,description,amount_inr,created_by,updated_by) VALUES(v_id,r.id,p_project_id,e->>'kind',btrim(e->>'description'),(e->>'amount_inr')::numeric,auth.uid(),auth.uid()) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,description=excluded.description,amount_inr=excluded.amount_inr,is_archived=false,updated_by=auth.uid(),updated_at=now();
      v_keep:=array_append(v_keep,v_id);
    END LOOP;
    UPDATE public.site_report_expenses SET is_archived=true,updated_by=auth.uid(),updated_at=now() WHERE report_id=r.id AND NOT(id=ANY(v_keep)) AND NOT is_archived;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'description',description,'amount_inr',amount_inr) ORDER BY id),'[]')::text INTO v_new FROM public.site_report_expenses WHERE report_id=r.id AND NOT is_archived;
    IF v_log THEN PERFORM public._site_report_log(r.id,p_project_id,'expenses',v_old,v_new); END IF;
  END IF;
  RETURN r.id;$new$);
 EXECUTE d;
END $patch$;
DO $patch$
DECLARE d text; anchor text;
BEGIN
 d:=pg_get_functiondef('public.get_site_report(uuid,date)'::regprocedure);
 anchor:='''planned_start'',t.planned_start_date,''actual_start'',t.actual_start_date';
 IF position(anchor IN d)=0 THEN RAISE EXCEPTION 'Get task anchor missing'; END IF;
 d:=replace(d,anchor,$new$'planned_start',t.planned_start_date,'planned_finish',t.planned_finish_date,'actual_start',t.actual_start_date,
 'in_report',EXISTS(SELECT 1 FROM public.site_report_task_progress sp WHERE sp.report_id=r.id AND sp.task_id=t.id),
 'previous_report',EXISTS(SELECT 1 FROM public.site_report_task_progress sp WHERE sp.task_id=t.id AND sp.report_id=(SELECT id FROM public.daily_measurements WHERE project_id=p_project_id AND trade='daily_site_report' AND report_status='submitted' AND NOT is_archived AND measurement_date<p_date ORDER BY measurement_date DESC LIMIT 1))$new$);
 d:=replace(d,'t.completion_percentage<100 OR EXISTS','coalesce(t.completion_percentage,0)<100 OR EXISTS');
 anchor:='''boq_qty'',b.boq_qty,';
 IF position(anchor IN d)=0 THEN RAISE EXCEPTION 'Get BOQ anchor missing'; END IF;
 d:=replace(d,anchor,$new$'boq_qty',b.boq_qty,'progress_weight',coalesce(b.boq_rate/nullif((SELECT sum(x.boq_qty*x.boq_rate) FROM public.project_boq_items x WHERE x.boq_id=v_boq AND x.schedule_task_id=b.schedule_task_id),0),0),$new$);
 d:=replace(d,'d.measurement_date<=p_date))','d.measurement_date<=p_date AND d.id IS DISTINCT FROM r.id))');
 d:=replace(d,'''pct'',completion_percentage_after,''remarks'',remarks','''pct'',completion_percentage_after,''remarks'',remarks,''task_status'',task_status');
 anchor:='''can_see_rates'', v_rates';
 IF position(anchor IN d)=0 THEN RAISE EXCEPTION 'Get keys anchor missing'; END IF;
 d:=replace(d,anchor,$new$'can_see_rates',v_rates,
 'present_workers',coalesce((SELECT jsonb_agg(jsonb_build_object('worker_id',a.worker_id,'name',w.name,'skill_type',w.skill_type,'contractor_name',c.company_name,'attendance_hours',a.hours) ORDER BY w.name,a.worker_id) FROM public.labour_attendance a JOIN public.labour_workers w ON w.id=a.worker_id LEFT JOIN public.labour_contractors c ON c.id=w.contractor_id WHERE a.project_id=p_project_id AND a.work_date=p_date AND a.hours>0),'[]'),
 'task_workers',coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',task_id,'worker_id',worker_id,'hours',hours)) FROM public.site_report_task_workers WHERE report_id=r.id AND NOT is_archived),'[]'),
 'task_worker_task_ids',coalesce((SELECT jsonb_agg(DISTINCT task_id) FROM public.site_report_task_workers WHERE report_id=r.id),'[]'),
 'expenses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'description',description,'amount_inr',amount_inr) ORDER BY created_at,id) FROM public.site_report_expenses WHERE report_id=r.id AND NOT is_archived),'[]'),
 'unconfirmed_workers',(SELECT count(*) FROM public.labour_attendance WHERE project_id=p_project_id AND work_date=p_date AND hours>0 AND NOT hours_confirmed)$new$);
 EXECUTE d;
END $patch$;
DO $patch$
DECLARE d text; a integer; b integer; anchor text;
BEGIN
 d:=pg_get_functiondef('public.submit_site_report(uuid)'::regprocedure);
 a:=position('  IF NOT EXISTS (SELECT 1 FROM public.project_elevations' IN d); b:=position('  SELECT count(*) INTO v_qty FROM public.labour_attendance' IN d);
 IF a=0 OR b<=a THEN RAISE EXCEPTION 'Submit photo anchors missing'; END IF;
 d:=overlay(d placing '' FROM a FOR b-a);
 anchor:='  IF NOT EXISTS (SELECT 1 FROM public.site_report_task_progress WHERE report_id=r.id AND completion_percentage_after IS NOT NULL)';
 IF position(anchor IN d)=0 THEN RAISE EXCEPTION 'Submit work gate anchor missing'; END IF;
 d:=replace(d,anchor,$new$  PERFORM public._site_report_validate_task_workers(r.id);
  IF NOT EXISTS(SELECT 1 FROM public.site_report_task_progress sp WHERE sp.report_id=r.id AND (sp.completion_percentage_after IS NOT NULL OR sp.task_status='completed'))
     AND NOT EXISTS(SELECT 1 FROM public.site_report_quantities WHERE report_id=r.id AND today_qty>0 AND boq_item_id IS NOT NULL)
     AND NOT EXISTS(SELECT 1 FROM public.site_report_task_workers WHERE report_id=r.id AND NOT is_archived)$new$);
 anchor:='  FOR p IN SELECT sp.task_id, sp.completion_percentage_after pct';
 IF position(anchor IN d)=0 THEN RAISE EXCEPTION 'Submit calculation anchor missing'; END IF;
 d:=replace(d,anchor,$new$
  WITH latest_boq AS(SELECT id FROM public.project_boq WHERE project_id=r.project_id ORDER BY version_number DESC,uploaded_at DESC LIMIT 1),
  vals AS(SELECT b.schedule_task_id tid,sum(coalesce(b.boq_qty,0)*coalesce(b.boq_rate,0)) total,sum(coalesce(b.boq_rate,0)*(SELECT coalesce(sum(q.today_qty),0) FROM public.site_report_quantities q JOIN public.daily_measurements dm ON dm.id=q.report_id WHERE q.boq_item_id=b.id AND NOT dm.is_archived AND dm.trade='daily_site_report' AND (dm.id=r.id OR(dm.report_status='submitted' AND dm.measurement_date<=r.measurement_date AND dm.id<>r.id)))) done FROM public.project_boq_items b WHERE b.boq_id=(SELECT id FROM latest_boq) AND b.schedule_task_id IS NOT NULL GROUP BY b.schedule_task_id)
  UPDATE public.site_report_task_progress sp SET completion_percentage_after=CASE WHEN sp.task_status='completed' THEN 100 WHEN vals.total>0 THEN least(100,round(100*vals.done/vals.total)) ELSE sp.completion_percentage_after END,updated_by=auth.uid(),updated_at=now() FROM vals WHERE sp.report_id=r.id AND sp.task_id=vals.tid;
  UPDATE public.site_report_task_progress SET completion_percentage_after=100,updated_by=auth.uid(),updated_at=now() WHERE report_id=r.id AND task_status='completed';
  FOR p IN SELECT sp.task_id, sp.completion_percentage_after pct$new$);
 d:=replace(d,'    UPDATE public.project_tasks SET',$new$    IF p.pct<p.old_pct AND NOT(r.report_status='submitted' AND r.submitted_by=auth.uid()) THEN v_skipped:=v_skipped||jsonb_build_object('task_id',p.task_id,'code',p.code,'reason','Lower than current progress'); CONTINUE; END IF;
    UPDATE public.project_tasks SET$new$);
 EXECUTE d;
END $patch$;
DO $patch$
DECLARE d text; a integer; b integer;
BEGIN
 d:=pg_get_functiondef('public.get_running_bill(uuid,date)'::regprocedure); a:=position('  th AS (' IN d); b:=position('  sub AS (' IN d);
 IF a=0 OR b<=a THEN RAISE EXCEPTION 'Running bill allocation anchors missing'; END IF;
 d:=overlay(d placing $new$  exact_days AS(SELECT DISTINCT rpt.measurement_date d FROM rpt JOIN public.site_report_task_workers tw ON tw.report_id=rpt.id),
  exact_alloc AS(SELECT tw.task_id,a.work_date,a.worker_id,tw.hours h,(a.amount/a.hours)*tw.hours amt FROM public.site_report_task_workers tw JOIN rpt ON rpt.id=tw.report_id JOIN att a ON a.work_date=rpt.measurement_date AND a.worker_id=tw.worker_id WHERE NOT tw.is_archived),
  th AS(SELECT rpt.measurement_date d,l.task_id,sum(l.hours) h FROM public.site_report_labour l JOIN rpt ON rpt.id=l.report_id WHERE l.hours>0 AND rpt.measurement_date NOT IN(SELECT d FROM exact_days) GROUP BY 1,2),
  tht AS(SELECT d,sum(h) total FROM th GROUP BY d),
  alloc AS(
    SELECT task_id,amt,h,'Exact'::text allocation FROM exact_alloc
    UNION ALL SELECT NULL,greatest(a.amount-coalesce(x.amt,0),0),greatest(a.hours-coalesce(x.h,0),0),'Exact' FROM att a LEFT JOIN(SELECT work_date,worker_id,sum(amt) amt,sum(h) h FROM exact_alloc GROUP BY 1,2) x ON x.work_date=a.work_date AND x.worker_id=a.worker_id WHERE a.work_date IN(SELECT d FROM exact_days) AND a.hours>coalesce(x.h,0)
    UNION ALL SELECT th.task_id,bday.amount*th.h/tht.total,th.h,'Approximate' FROM bday JOIN th ON th.d=bday.work_date JOIN tht ON tht.d=bday.work_date
    UNION ALL SELECT NULL,bday.amount,bday.hours,'Approximate' FROM bday WHERE work_date NOT IN(SELECT d FROM exact_days) AND NOT EXISTS(SELECT 1 FROM tht WHERE tht.d=bday.work_date)
  ),
  btask AS(SELECT coalesce(pt.task_id_in_schedule,'') code,coalesce(pt.task_name,'Unallocated') task,sum(alloc.h) task_hours,round(sum(alloc.amt),2) amount,alloc.allocation FROM alloc LEFT JOIN public.project_tasks pt ON pt.id=alloc.task_id GROUP BY 1,2,alloc.allocation),
$new$ FROM a FOR b-a);
 EXECUTE d;
END $patch$;