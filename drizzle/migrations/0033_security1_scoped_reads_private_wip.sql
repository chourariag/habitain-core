CREATE TEMP TABLE security1_subjects(role text PRIMARY KEY,uid uuid,synthetic boolean) ON COMMIT DROP;
INSERT INTO security1_subjects SELECT role,COALESCE((SELECT auth_user_id FROM public.profiles p WHERE p.role::text=k.role AND p.is_active AND p.auth_user_id IS NOT NULL ORDER BY p.id LIMIT 1),gen_random_uuid()),NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role::text=k.role AND p.is_active AND p.auth_user_id IS NOT NULL) FROM unnest(ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','planning_head','planning_engineer','head_of_projects','production_head','head_operations','qc_inspector','sales_executive','sales_associate','delivery_rm_lead','marketing','finance_manager','costing_engineer','quantity_surveyor','procurement_assistant','purchase_assistant','hr_executive','stores_executive']) k(role);
GRANT SELECT ON security1_subjects TO authenticated;
CREATE TEMP TABLE security1_counts(role text,table_name text,synthetic boolean,before_count bigint,after_count bigint,PRIMARY KEY(role,table_name)) ON COMMIT DROP;
GRANT SELECT,INSERT,UPDATE ON security1_counts TO authenticated;
CREATE TEMP TABLE security1_helper_originals AS SELECT p.oid,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('has_role','get_user_role','user_has_any_role');
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_temp.security1_subjects s WHERE s.uid=_user_id AND s.synthetic) THEN EXISTS(SELECT 1 FROM pg_temp.security1_subjects s WHERE s.uid=_user_id AND s.role=_role::text) ELSE EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=_user_id AND role=_role AND is_active=true) END $fn$;
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
SELECT COALESCE((SELECT s.role::public.app_role FROM pg_temp.security1_subjects s WHERE s.uid=_user_id AND s.synthetic),(SELECT role FROM public.profiles WHERE auth_user_id=_user_id AND is_active=true LIMIT 1)) $fn$;
CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id uuid,_roles public.app_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_temp.security1_subjects s WHERE s.uid=_user_id AND s.synthetic) THEN EXISTS(SELECT 1 FROM pg_temp.security1_subjects s WHERE s.uid=_user_id AND s.role=ANY(_roles::text[])) ELSE EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=_user_id AND is_active=true AND role=ANY(_roles)) END $fn$;
CREATE TEMP TABLE security1_targets(table_name text PRIMARY KEY,policy_name text,group_roles text[],project_column boolean) ON COMMIT DROP;
INSERT INTO security1_targets VALUES
('subcontractor_schedules','Authenticated users can view subcontractor schedules',ARRAY['planning_head','planning_engineer','head_of_projects','production_head','head_operations'],true),
('manpower_subcontractor_plan','mp_subs_read',ARRAY['planning_head','planning_engineer','head_of_projects','production_head','head_operations'],false),
('manpower_plans','manpower_plans_read',ARRAY['planning_head','planning_engineer','head_of_projects','production_head','head_operations'],true),
('manpower_plan_entries','mp_entries_read',ARRAY['planning_head','planning_engineer','head_of_projects','production_head','head_operations'],false),
('project_scope_items','Authenticated users can view scope items',ARRAY['planning_head','planning_engineer','head_of_projects','production_head','head_operations'],false),
('panels','Authenticated can view panels',ARRAY['planning_head','planning_engineer','head_of_projects','production_head','head_operations'],false),
('production_stages','Authenticated can view stages',ARRAY['planning_head','planning_engineer','head_of_projects','production_head','head_operations'],false),
('project_progress_matrix','auth read ppm',ARRAY['planning_head','planning_engineer','head_of_projects','production_head','head_operations'],true),
('qc_checklist_items','Authenticated can view checklist',ARRAY['qc_inspector','head_of_projects','production_head','planning_head'],false),
('sales_amc_contacts','Authenticated can view sales_amc_contacts',ARRAY['sales_executive','sales_associate','delivery_rm_lead','marketing'],false),
('approval_thresholds','Auth read thresholds',ARRAY['finance_manager','costing_engineer','quantity_surveyor','planning_head'],false);
GRANT SELECT ON security1_targets TO authenticated;
DO $before$ DECLARE s record;t record;v_count bigint; BEGIN
FOR s IN SELECT * FROM pg_temp.security1_subjects LOOP
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',s.uid,'role','authenticated')::text,true);
FOR t IN SELECT * FROM pg_temp.security1_targets LOOP
EXECUTE 'SET LOCAL ROLE authenticated';EXECUTE format('SELECT count(*) FROM public.%I',t.table_name) INTO v_count;EXECUTE 'RESET ROLE';
INSERT INTO pg_temp.security1_counts VALUES(s.role,t.table_name,s.synthetic,v_count,NULL);
END LOOP;END LOOP;END $before$;
DO $scope$ DECLARE t record;p record;original text;roles_sql text;predicate text; BEGIN
FOR t IN SELECT * FROM pg_temp.security1_targets ORDER BY table_name LOOP
SELECT * INTO p FROM pg_policies WHERE schemaname='public' AND tablename=t.table_name AND policyname=t.policy_name;
IF NOT FOUND OR p.cmd<>'SELECT' OR p.qual<>'true' OR p.permissive<>'PERMISSIVE' THEN RAISE EXCEPTION 'Missing/changed anchor: %.%',t.table_name,t.policy_name;END IF;
IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t.table_name AND policyname=t.policy_name||'_scoped') THEN RAISE EXCEPTION 'Scoped policy already exists';END IF;
SELECT string_agg(quote_ident(x),', ') INTO roles_sql FROM unnest(p.roles) x;
original:=format('DROP POLICY IF EXISTS %I ON public.%I; DROP POLICY IF EXISTS %I ON public.%I; CREATE POLICY %I ON public.%I AS %s FOR %s TO %s USING (%s);',t.policy_name||'_scoped',t.table_name,t.policy_name,t.table_name,t.policy_name,t.table_name,p.permissive,p.cmd,roles_sql,p.qual);
INSERT INTO public.parity2_backup(object_kind,object_name,original_definition) VALUES('policy','public.'||t.table_name||'.'||t.policy_name,original);
predicate:=format('public.is_tier1_or_super(auth.uid()) OR public.user_has_any_role(auth.uid(), %L::public.app_role[])',t.group_roles::text);
IF t.project_column THEN predicate:=predicate||' OR public.user_can_access_project(auth.uid(), project_id)';END IF;
EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',t.policy_name,t.table_name,predicate);
EXECUTE format('ALTER POLICY %I ON public.%I RENAME TO %I',t.policy_name,t.table_name,t.policy_name||'_scoped');
END LOOP;END $scope$;
DO $after$ DECLARE s record;t record;v_count bigint;b bigint;allowed boolean; BEGIN
FOR s IN SELECT * FROM pg_temp.security1_subjects LOOP
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',s.uid,'role','authenticated')::text,true);
FOR t IN SELECT * FROM pg_temp.security1_targets LOOP
EXECUTE 'SET LOCAL ROLE authenticated';EXECUTE format('SELECT count(*) FROM public.%I',t.table_name) INTO v_count;EXECUTE 'RESET ROLE';
SELECT before_count INTO b FROM pg_temp.security1_counts WHERE role=s.role AND table_name=t.table_name;
UPDATE pg_temp.security1_counts SET after_count=v_count WHERE role=s.role AND table_name=t.table_name;
allowed:=s.role=ANY(t.group_roles) OR s.role=ANY(ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director']);
IF allowed AND v_count<b THEN RAISE EXCEPTION 'Reader lost access: %, %, % -> %',s.role,t.table_name,b,v_count;END IF;
IF s.role='stores_executive' AND v_count>b THEN RAISE EXCEPTION 'Control gained access: %',t.table_name;END IF;
END LOOP;END LOOP;
RAISE NOTICE 'SECURITY1_COUNTS %',(SELECT jsonb_agg(to_jsonb(result) ORDER BY table_name,role) FROM pg_temp.security1_counts result);
FOR t IN SELECT definition FROM pg_temp.security1_helper_originals LOOP EXECUTE t.definition;END LOOP;
PERFORM set_config('request.jwt.claims','{}',true);
END $after$;
CREATE TABLE public.daily_measurement_wip(measurement_id uuid PRIMARY KEY REFERENCES public.daily_measurements(id),total_wip_today numeric NOT NULL DEFAULT 0,wip_needs_review boolean NOT NULL DEFAULT false,wip_review_reason text,created_by uuid DEFAULT auth.uid(),updated_by uuid DEFAULT auth.uid(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.daily_measurement_wip TO authenticated;
GRANT ALL ON public.daily_measurement_wip TO service_role;
ALTER TABLE public.daily_measurement_wip ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_measurement_wip_finance_read ON public.daily_measurement_wip FOR SELECT TO authenticated USING(public.is_tier1_or_super(auth.uid()) OR public.has_role(auth.uid(),'finance_manager'));
INSERT INTO public.daily_measurement_wip(measurement_id,total_wip_today,wip_needs_review,wip_review_reason,created_by,updated_by) SELECT id,coalesce(total_wip_today,0),coalesce(wip_needs_review,false),wip_review_reason,created_by,updated_by FROM public.daily_measurements;
UPDATE public.daily_measurements SET total_wip_today=0,wip_needs_review=false,wip_review_reason=NULL;
COMMENT ON COLUMN public.daily_measurements.total_wip_today IS 'DEPRECATED: moved to daily_measurement_wip; neutral compatibility value only';
COMMENT ON COLUMN public.daily_measurements.wip_needs_review IS 'DEPRECATED: moved to daily_measurement_wip; neutral compatibility value only';
COMMENT ON COLUMN public.daily_measurements.wip_review_reason IS 'DEPRECATED: moved to daily_measurement_wip; neutral compatibility value only';
CREATE FUNCTION public.security1_neutralize_legacy_wip() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$ BEGIN NEW.total_wip_today:=0;NEW.wip_needs_review:=false;NEW.wip_review_reason:=NULL;RETURN NEW;END $fn$;
CREATE TRIGGER security1_neutralize_legacy_wip BEFORE INSERT OR UPDATE OF total_wip_today,wip_needs_review,wip_review_reason ON public.daily_measurements FOR EACH ROW EXECUTE FUNCTION public.security1_neutralize_legacy_wip();
DO $writers$ DECLARE original text;changed text;anchor text;replacement text; BEGIN
SELECT pg_get_functiondef('public.submit_site_report(uuid)'::regprocedure) INTO original;
anchor:=$anchor$  UPDATE public.daily_measurements SET
    total_wip_today = coalesce(v_wip,0),
    wip_needs_review = (v_rated = 0 AND v_qty > 0) OR v_rated < v_qty,
    wip_review_reason = CASE WHEN v_rated < v_qty THEN 'Some quantities have no BOQ rate; WIP not computed for them' ELSE NULL END,
    report_status='submitted',$anchor$;
replacement:=$replacement$  INSERT INTO public.daily_measurement_wip(measurement_id,total_wip_today,wip_needs_review,wip_review_reason,created_by,updated_by)
  VALUES(r.id,coalesce(v_wip,0),(v_rated = 0 AND v_qty > 0) OR v_rated < v_qty,
    CASE WHEN v_rated < v_qty THEN 'Some quantities have no BOQ rate; WIP not computed for them' ELSE NULL END,auth.uid(),auth.uid())
  ON CONFLICT(measurement_id) DO UPDATE SET total_wip_today=excluded.total_wip_today,wip_needs_review=excluded.wip_needs_review,wip_review_reason=excluded.wip_review_reason,updated_by=auth.uid(),updated_at=now();
  UPDATE public.daily_measurements SET
    report_status='submitted',$replacement$;
IF position(anchor IN original)=0 THEN RAISE EXCEPTION 'Missing submit WIP anchor';END IF;
INSERT INTO public.parity2_backup(object_kind,object_name,original_definition) VALUES('function','public.submit_site_report(uuid)',original);EXECUTE replace(original,anchor,replacement);
SELECT pg_get_functiondef('public.apply_record_edit(text,uuid,jsonb,text,text)'::regprocedure) INTO original;
anchor:=$anchor$      UPDATE public.daily_measurements
        SET wip_needs_review = true,
            wip_review_reason = 'Source measurement edited after billing was finalized - manual review required'
        WHERE id = v_measurement;$anchor$;
replacement:=$replacement$      UPDATE public.daily_measurement_wip
        SET wip_needs_review = true,
            wip_review_reason = 'Source measurement edited after billing was finalized - manual review required',updated_by=v_user,updated_at=now()
        WHERE measurement_id = v_measurement;$replacement$;
IF position(anchor IN original)=0 THEN RAISE EXCEPTION 'Missing edit review anchor';END IF;
changed:=replace(original,anchor,replacement);
anchor:=$anchor$      UPDATE public.daily_measurements dm
        SET total_wip_today = COALESCE((SELECT SUM(wip_today) FROM public.measurement_line_items WHERE measurement_id = dm.id),0)
        WHERE dm.id = v_measurement;$anchor$;
replacement:=$replacement$      INSERT INTO public.daily_measurement_wip(measurement_id,total_wip_today,created_by,updated_by)
        VALUES(v_measurement,COALESCE((SELECT SUM(wip_today) FROM public.measurement_line_items WHERE measurement_id=v_measurement),0),v_user,v_user)
        ON CONFLICT(measurement_id) DO UPDATE SET total_wip_today=excluded.total_wip_today,updated_by=v_user,updated_at=now();$replacement$;
IF position(anchor IN changed)=0 THEN RAISE EXCEPTION 'Missing edit total anchor';END IF;
INSERT INTO public.parity2_backup(object_kind,object_name,original_definition) VALUES('function','public.apply_record_edit(text,uuid,jsonb,text,text)',original);EXECUTE replace(changed,anchor,replacement);END $writers$;
CREATE FUNCTION public.save_factory_measurement_wip(p_measurement_id uuid,p_total numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE r public.daily_measurements%ROWTYPE;BEGIN SELECT * INTO r FROM public.daily_measurements WHERE id=p_measurement_id;
IF auth.uid() IS NULL OR r.id IS NULL OR r.location<>'factory' OR r.submitted_by IS DISTINCT FROM auth.uid() OR NOT public.can_submit_factory_measurement(auth.uid()) THEN RAISE EXCEPTION 'Not allowed';END IF;
IF p_total IS NULL OR p_total<0 THEN RAISE EXCEPTION 'Invalid WIP amount';END IF;
INSERT INTO public.daily_measurement_wip(measurement_id,total_wip_today,created_by,updated_by) VALUES(r.id,p_total,auth.uid(),auth.uid()) ON CONFLICT(measurement_id) DO UPDATE SET total_wip_today=excluded.total_wip_today,updated_by=auth.uid(),updated_at=now();END $fn$;
REVOKE ALL ON FUNCTION public.save_factory_measurement_wip(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_factory_measurement_wip(uuid,numeric) TO authenticated,service_role;
DO $verify$ BEGIN
IF (SELECT count(*) FROM pg_policies p JOIN pg_temp.security1_targets t ON p.tablename=t.table_name AND p.policyname=t.policy_name||'_scoped' WHERE p.qual<>'true')<>11 THEN RAISE EXCEPTION 'Scoped policy count mismatch';END IF;
IF EXISTS(SELECT 1 FROM public.daily_measurements WHERE total_wip_today<>0 OR wip_needs_review OR wip_review_reason IS NOT NULL) THEN RAISE EXCEPTION 'Legacy WIP leak';END IF;
IF (SELECT count(*) FROM public.daily_measurement_wip)<>(SELECT count(*) FROM public.daily_measurements) THEN RAISE EXCEPTION 'WIP backfill count mismatch';END IF;
IF (SELECT count(*) FROM public.reminder_events)<>0 THEN RAISE EXCEPTION 'Reminder events changed';END IF;
END $verify$;