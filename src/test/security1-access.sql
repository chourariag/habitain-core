BEGIN;
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
DO $original$ DECLARE t record; BEGIN FOR t IN SELECT * FROM pg_temp.security1_targets LOOP EXECUTE format('ALTER POLICY %I ON public.%I USING (true)',t.policy_name||'_scoped',t.table_name); EXECUTE format('ALTER POLICY %I ON public.%I RENAME TO %I',t.policy_name||'_scoped',t.table_name,t.policy_name); END LOOP; END $original$;
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
-- no backup writes during regression
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

DO $readiness$ DECLARE s record;p record;allowed boolean;actual boolean;v_pass int:=0;BEGIN
FOR s IN SELECT * FROM pg_temp.security1_subjects WHERE NOT synthetic LOOP
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',s.uid,'role','authenticated')::text,true);
 allowed:=s.role=ANY(ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','planning_engineer','delivery_rm_lead']);
 FOR p IN SELECT cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='site_readiness' AND cmd IN ('INSERT','UPDATE') LOOP
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE 'SELECT ('||coalesce(p.with_check,p.qual)||')' INTO actual;
  EXECUTE 'RESET ROLE';
  IF actual IS DISTINCT FROM allowed THEN RAISE EXCEPTION 'site_readiness % gate mismatch for %',p.cmd,s.role;END IF;
  v_pass:=v_pass+1;
 END LOOP;
END LOOP;
IF v_pass<30 THEN RAISE EXCEPTION 'Insufficient readiness role checks';END IF;
RAISE NOTICE 'SITE_READINESS_SQL_ROLE_CHECKS %',v_pass;
PERFORM set_config('request.jwt.claims','{}',true);
END $readiness$;
SELECT jsonb_agg(to_jsonb(result) ORDER BY table_name,role) AS access_counts FROM pg_temp.security1_counts result;

ROLLBACK;
