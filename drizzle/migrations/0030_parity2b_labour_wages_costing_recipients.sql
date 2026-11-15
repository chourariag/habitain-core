DO $parity2b$
DECLARE sig text; original text; rewritten text; anchor text;
BEGIN
FOREACH sig IN ARRAY ARRAY['public.can_access_labour_compensation(uuid)','public.commit_labour_master_upload(jsonb)','public.notify_costing_on_measurement_submit()'] LOOP
original:=pg_get_functiondef(sig::regprocedure);
INSERT INTO public.parity2_backup(object_kind,object_name,original_definition) VALUES('function',sig,original);
IF sig='public.can_access_labour_compensation(uuid)' THEN
anchor:='role IN (''super_admin'',''managing_director'',''finance_director'',''finance_manager'',''hr_executive'')';
IF position(anchor IN original)=0 THEN RAISE EXCEPTION 'Labour visibility anchor missing';END IF;
rewritten:=replace(original,anchor,'(public.is_tier1_or_super(_user_id) OR role IN (''finance_manager'',''hr_executive''))');
ELSIF sig='public.commit_labour_master_upload(jsonb)' THEN
anchor:='public.get_user_role(auth.uid())::text = ANY (ARRAY[''planning_head'',''managing_director'',''finance_director'',''sales_director'',''architecture_director'',''super_admin'',''head_of_projects''])';
IF position(anchor IN original)=0 THEN RAISE EXCEPTION 'Labour master authorization anchor missing';END IF;
rewritten:=replace(original,anchor,'(public.is_tier1_or_super(auth.uid()) OR public.get_user_role(auth.uid())::text = ANY (ARRAY[''planning_head'',''head_of_projects'']))');
ELSE
anchor:='SELECT auth_user_id FROM public.profiles'||chr(10)||'      WHERE is_active = true AND role IN (''costing_engineer'',''production_head'',''head_operations'',''managing_director'')';
IF position(anchor IN original)=0 OR position('IF NEW.trade = ''daily_site_report'' THEN' IN original)=0 THEN RAISE EXCEPTION 'Costing recipient or P4e anchor missing';END IF;
rewritten:=replace(original,anchor,'SELECT DISTINCT auth_user_id FROM public.profiles'||chr(10)||'      WHERE is_active = true AND auth_user_id IS NOT NULL AND (public.is_tier1(auth_user_id) OR role IN (''costing_engineer'',''production_head'',''head_operations''))');
END IF;
EXECUTE rewritten;
IF sig<>'public.notify_costing_on_measurement_submit()' AND position('is_tier1_or_super' IN pg_get_functiondef(sig::regprocedure))=0 THEN RAISE EXCEPTION 'Tier helper verification failed';END IF;
END LOOP;
END $parity2b$;