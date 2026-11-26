CREATE POLICY "Site engineers can update own site task actuals"
ON public.project_tasks FOR UPDATE TO authenticated
USING (
 public.get_user_role(auth.uid()) = 'site_engineer'::public.app_role
 AND is_removed = false
 AND responsible_role IN ('site_installation_mgr','site_engineer')
 AND task_type = 'task'::public.task_template_type
 AND is_qc_gate = false AND is_payment_milestone = false
 AND public.user_can_access_project(auth.uid(), project_id)
)
WITH CHECK (
 public.get_user_role(auth.uid()) = 'site_engineer'::public.app_role
 AND is_removed = false
 AND responsible_role IN ('site_installation_mgr','site_engineer')
 AND task_type = 'task'::public.task_template_type
 AND is_qc_gate = false AND is_payment_milestone = false
 AND public.user_can_access_project(auth.uid(), project_id)
);

CREATE FUNCTION public.site_engineer_task_actuals_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
 allowed text[] := ARRAY['completion_percentage','status','actual_start_date','actual_finish_date','remarks','delay_cause','delay_resolution'];
BEGIN
 IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'site_engineer'::public.app_role THEN RETURN NEW; END IF;
 IF OLD.is_removed OR OLD.responsible_role IS NULL
 OR OLD.responsible_role NOT IN ('site_installation_mgr','site_engineer')
 OR OLD.task_type <> 'task'::public.task_template_type
 OR OLD.is_qc_gate OR OLD.is_payment_milestone
 OR NOT public.user_can_access_project(auth.uid(), OLD.project_id) THEN
  RAISE EXCEPTION 'You can update progress only on ordinary site tasks in projects you can access' USING ERRCODE='42501';
 END IF;
 -- Runs before all other BEFORE UPDATE triggers. Compare the complete row,
 -- excluding only the seven permitted fields: future columns are denied by default.
 IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
  RAISE EXCEPTION 'Site engineers can update progress, actual dates and notes only; schedule and other task fields cannot be changed' USING ERRCODE='42501';
 END IF;
 IF (to_jsonb(NEW) - (SELECT array_agg(key) FROM jsonb_object_keys(to_jsonb(NEW)) key WHERE NOT key = ANY(allowed)))
 IS DISTINCT FROM (to_jsonb(OLD) - (SELECT array_agg(key) FROM jsonb_object_keys(to_jsonb(OLD)) key WHERE NOT key = ANY(allowed))) THEN
  INSERT INTO public.schedule_audit_log(project_id, task_id, entity, action, old_value, new_value, actor_id)
  VALUES (OLD.project_id, OLD.id, 'task', 'site_actuals_update',
   jsonb_build_object('completion_percentage',OLD.completion_percentage,'status',OLD.status,'actual_start_date',OLD.actual_start_date,'actual_finish_date',OLD.actual_finish_date,'remarks',OLD.remarks,'delay_cause',OLD.delay_cause,'delay_resolution',OLD.delay_resolution),
   jsonb_build_object('completion_percentage',NEW.completion_percentage,'status',NEW.status,'actual_start_date',NEW.actual_start_date,'actual_finish_date',NEW.actual_finish_date,'remarks',NEW.remarks,'delay_cause',NEW.delay_cause,'delay_resolution',NEW.delay_resolution), auth.uid());
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.site_engineer_task_actuals_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER aaa_site_engineer_task_actuals_guard BEFORE UPDATE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.site_engineer_task_actuals_guard();