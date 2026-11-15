CREATE OR REPLACE FUNCTION public.is_tier1(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(_uid,'managing_director') OR public.has_role(_uid,'finance_director') OR public.has_role(_uid,'sales_director') OR public.has_role(_uid,'architecture_director'); $$;
CREATE OR REPLACE FUNCTION public.is_tier1_or_super(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_tier1(_uid) OR public.has_role(_uid,'super_admin'); $$;
REVOKE ALL ON FUNCTION public.is_tier1(uuid),public.is_tier1_or_super(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tier1(uuid),public.is_tier1_or_super(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.can_manage_project_elevations(_uid uuid,_project_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT _uid IS NOT NULL AND public.user_can_access_project(_uid,_project_id) AND (public.is_tier1_or_super(_uid) OR public.has_role(_uid,'planning_head') OR public.has_role(_uid,'head_of_projects')); $$;
CREATE OR REPLACE FUNCTION public.can_write_site_report(_uid uuid,_project_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT _uid IS NOT NULL AND public.user_can_access_project(_uid,_project_id) AND (public.is_tier1_or_super(_uid) OR public.has_role(_uid,'site_engineer') OR public.has_role(_uid,'site_installation_mgr') OR public.has_role(_uid,'head_of_projects') OR public.has_role(_uid,'planning_head')); $$;
-- Only inspected Wave 1 definitions are changed; no global legacy role helper is rewritten.
DO $migration$ DECLARE f record; definition text; BEGIN
FOR f IN SELECT p.oid,p.proname FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f' AND p.proname IN ('update_reminder_rule','update_escalation_level','list_open_reminders','get_project_setup_status','commit_project_setup_upload','commit_project_setup_upload_validated','save_labour_attendance','get_labour_attendance_warnings','commit_labour_master_upload','set_feature_flag','get_scheduled_job_status') LOOP
 definition:=pg_get_functiondef(f.oid);
 definition:=regexp_replace(definition,'public\.has_role\(([^,]+),\s*''managing_director''(::public\.app_role)?\)','public.is_tier1_or_super(\1)','g');
 IF f.proname IN ('update_reminder_rule','update_escalation_level') THEN
 definition:=replace(definition,'public.has_role(auth.uid(),''super_admin'')','public.is_tier1_or_super(auth.uid())');
 definition:=replace(definition,'Only Super Admin can edit','Only Tier 1 or Super Admin can edit');
 END IF;
 IF f.proname IN ('save_labour_attendance','get_labour_attendance_warnings','commit_labour_master_upload') THEN
 definition:=replace(definition,'''managing_director''','''managing_director'',''finance_director'',''sales_director'',''architecture_director''');
 END IF;
 EXECUTE definition;
END LOOP;
END $migration$;
CREATE OR REPLACE FUNCTION public.reminder_recipient_ids(p_role text,p_project uuid,p_owner uuid) RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[]:='{}'; BEGIN
IF p_role='managing_director' THEN
 SELECT coalesce(array_agg(DISTINCT p.auth_user_id ORDER BY p.auth_user_id),'{}') INTO ids FROM public.profiles p WHERE p.is_active AND NOT coalesce(p.is_archived,false) AND public.is_tier1(p.auth_user_id);
ELSIF p_role='owner' AND p_owner IS NOT NULL THEN
 SELECT coalesce(array_agg(p.auth_user_id ORDER BY p.auth_user_id),'{}') INTO ids FROM public.profiles p WHERE p.auth_user_id=p_owner AND p.is_active AND NOT coalesce(p.is_archived,false);
ELSIF p_project IS NOT NULL THEN
 SELECT coalesce(array_agg(DISTINCT p.auth_user_id ORDER BY p.auth_user_id),'{}') INTO ids FROM public.project_team_members tm JOIN public.profiles p ON p.id=tm.profile_id WHERE tm.project_id=p_project AND tm.is_active AND p.is_active AND NOT coalesce(p.is_archived,false) AND ((p_role='owner' AND tm.role IN ('site_engineer','site_installation_mgr')) OR (p_role<>'owner' AND tm.role=p_role));
 IF cardinality(ids)=0 AND p_role='owner' THEN
 SELECT coalesce(array_agg(DISTINCT p.auth_user_id ORDER BY p.auth_user_id),'{}') INTO ids FROM public.project_team_members tm JOIN public.profiles p ON p.id=tm.profile_id WHERE tm.project_id=p_project AND tm.is_active AND p.is_active AND NOT coalesce(p.is_archived,false) AND tm.role='head_of_projects';
 END IF;
END IF;
IF cardinality(ids)=0 AND p_role NOT IN ('owner','managing_director') THEN
 SELECT coalesce(array_agg(DISTINCT p.auth_user_id ORDER BY p.auth_user_id),'{}') INTO ids FROM public.profiles p WHERE p.is_active AND NOT coalesce(p.is_archived,false) AND public.has_role(p.auth_user_id,p_role::public.app_role);
END IF;
RETURN ids; END $$;
REVOKE ALL ON FUNCTION public.reminder_recipient_ids(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reminder_recipient_ids(text,uuid,uuid) TO service_role;
DO $migration$ DECLARE definition text; old_recipients text; BEGIN
SELECT pg_get_functiondef('public.run_reminders(boolean,timestamptz)'::regprocedure) INTO definition;
definition:=replace(definition,'public.has_role(auth.uid(),''managing_director'')','public.is_tier1_or_super(auth.uid())');
old_recipients:=substring(definition FROM strpos(definition,'ids:=''{}'';') FOR strpos(definition,'item:=jsonb_build_object')-strpos(definition,'ids:=''{}'';'));
IF old_recipients IS NULL OR old_recipients='' THEN RAISE EXCEPTION 'Reminder recipient block not found'; END IF;
definition:=replace(definition,old_recipients,'ids:=public.reminder_recipient_ids(l.notify_role,s.project_id,s.owner_id);'||chr(10));
-- Existing elapsed-hour level thresholds, notification summaries and dry-run write guards stay byte-identical.
EXECUTE definition;
END $migration$;
CREATE OR REPLACE FUNCTION public.acknowledge_reminder(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE selected_row public.reminder_events%ROWTYPE; e public.reminder_events%ROWTYPE; new_row jsonb; BEGIN
SELECT * INTO selected_row FROM public.reminder_events WHERE id=p_id;
IF selected_row.id IS NULL OR NOT (auth.uid()=ANY(selected_row.recipient_ids) OR public.is_tier1_or_super(auth.uid())) THEN RAISE EXCEPTION 'Only the addressed person or Tier 1 can acknowledge this reminder'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(selected_row.rule_key||':'||selected_row.subject_ref));
FOR e IN SELECT * FROM public.reminder_events WHERE rule_key=selected_row.rule_key AND subject_ref=selected_row.subject_ref AND resolved_at IS NULL ORDER BY level FOR UPDATE LOOP
UPDATE public.reminder_events SET acknowledged_at=coalesce(acknowledged_at,now()),resolved_at=now(),resolved_by=auth.uid()::text,acknowledgements=acknowledgements||jsonb_build_object(auth.uid()::text,now()),updated_at=now(),updated_by=auth.uid() WHERE id=e.id RETURNING to_jsonb(reminder_events) INTO new_row;
INSERT INTO public.reminder_change_log(actor,subject_ref,old_value,new_value) VALUES(auth.uid(),e.id::text,to_jsonb(e),new_row);
END LOOP; END $$;
DO $migration$ DECLARE p record; expression text; check_expression text; statement text; BEGIN
FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('reminder_rules','escalation_levels','reminder_events','reminder_change_log','labour_attendance','labour_attendance_edit_log','setup_change_log') LOOP
 expression:=p.qual;check_expression:=p.with_check;
 IF expression IS NOT NULL THEN
 expression:=regexp_replace(expression,'has_role\(auth.uid\(\), ''managing_director''::app_role\)','public.is_tier1_or_super(auth.uid())','g');
 IF p.tablename IN ('labour_attendance','labour_attendance_edit_log') THEN expression:=replace(expression,'''managing_director''::text','''managing_director''::text, ''finance_director''::text, ''sales_director''::text, ''architecture_director''::text'); END IF;
 END IF;
 IF check_expression IS NOT NULL THEN
 check_expression:=regexp_replace(check_expression,'has_role\(auth.uid\(\), ''managing_director''::app_role\)','public.is_tier1_or_super(auth.uid())','g');
 IF p.tablename='labour_attendance' THEN check_expression:=replace(check_expression,'''managing_director''::text','''managing_director''::text, ''finance_director''::text, ''sales_director''::text, ''architecture_director''::text'); END IF;
 END IF;
 statement:=format('ALTER POLICY %I ON public.%I',p.policyname,p.tablename);
 IF expression IS NOT NULL THEN statement:=statement||' USING ('||expression||')'; END IF;
 IF check_expression IS NOT NULL THEN statement:=statement||' WITH CHECK ('||check_expression||')'; END IF;
 EXECUTE statement;
END LOOP;
END $migration$;