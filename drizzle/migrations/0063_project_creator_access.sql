CREATE TABLE public.project_creators (
 user_id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true, note text,
 granted_by uuid NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_by uuid, revoked_at timestamptz,
 created_by uuid NOT NULL DEFAULT auth.uid(), updated_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), is_archived boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.project_creators TO service_role;
REVOKE ALL ON public.project_creators FROM PUBLIC, anon, authenticated;
ALTER TABLE public.project_creators ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.project_creators IS 'Private explicit project creation grants. No direct client access; revoke softly and retain audit history. Built-in directors/Super are never stored here.';

CREATE FUNCTION public.can_create_project(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _uid IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.auth_user_id=_uid AND p.is_active=true AND NOT coalesce(p.is_archived,false)) AND (public.is_tier1_or_super(_uid) OR EXISTS(SELECT 1 FROM public.project_creators c WHERE c.user_id=_uid AND c.is_active AND NOT c.is_archived));
$$;
REVOKE ALL ON FUNCTION public.can_create_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_project(uuid) TO authenticated;

CREATE FUNCTION public.list_project_creators() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_tier1_or_super(auth.uid()) OR NOT public.can_create_project(auth.uid()) THEN RAISE EXCEPTION 'Only active directors or Super Admin can manage project creators' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('built_in_label','Always allowed (Super Admin, MD, Directors)',
 'built_in',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.auth_user_id,'name',p.display_name,'roles',(SELECT jsonb_agg(r.role ORDER BY r.role::text) FROM public.user_roles r WHERE r.user_id=p.auth_user_id),'is_active',p.is_active,'built_in',true) ORDER BY p.display_name) FROM public.profiles p WHERE public.is_tier1_or_super(p.auth_user_id)),'[]'::jsonb),
 'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',c.user_id,'name',p.display_name,'roles',(SELECT jsonb_agg(r.role ORDER BY r.role::text) FROM public.user_roles r WHERE r.user_id=c.user_id),'is_active',c.is_active,'profile_active',p.is_active AND NOT coalesce(p.is_archived,false),'note',c.note,'granted_by',c.granted_by,'granted_by_name',g.display_name,'granted_at',c.granted_at,'revoked_by',c.revoked_by,'revoked_at',c.revoked_at,'built_in',false) ORDER BY c.is_active DESC,p.display_name) FROM public.project_creators c LEFT JOIN public.profiles p ON p.auth_user_id=c.user_id LEFT JOIN public.profiles g ON g.auth_user_id=c.granted_by),'[]'::jsonb),
 'candidates',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.auth_user_id,'name',p.display_name,'roles',(SELECT jsonb_agg(r.role ORDER BY r.role::text) FROM public.user_roles r WHERE r.user_id=p.auth_user_id)) ORDER BY p.display_name) FROM public.profiles p WHERE p.is_active=true AND NOT coalesce(p.is_archived,false) AND NOT public.is_tier1_or_super(p.auth_user_id) AND NOT EXISTS(SELECT 1 FROM public.project_creators c WHERE c.user_id=p.auth_user_id AND c.is_active AND NOT c.is_archived)),'[]'::jsonb)) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.list_project_creators() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_project_creators() TO authenticated;

CREATE FUNCTION public.grant_project_creator(p_user_id uuid,p_note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_tier1_or_super(auth.uid()) OR NOT public.can_create_project(auth.uid()) THEN RAISE EXCEPTION 'Only active directors or Super Admin can manage project creators' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=p_user_id AND is_active=true AND NOT coalesce(is_archived,false)) THEN RAISE EXCEPTION 'Select an active person'; END IF;
 IF public.is_tier1_or_super(p_user_id) THEN RAISE EXCEPTION 'Super Admin, MD and Directors are always allowed and cannot receive explicit grants'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,63));
 SELECT jsonb_build_object('is_active',is_active,'note',note) INTO v_old FROM public.project_creators WHERE user_id=p_user_id FOR UPDATE;
 INSERT INTO public.project_creators(user_id,is_active,note,granted_by,granted_at,created_by,updated_by) VALUES(p_user_id,true,nullif(btrim(p_note),''),auth.uid(),now(),auth.uid(),auth.uid())
 ON CONFLICT(user_id) DO UPDATE SET is_active=true,is_archived=false,note=excluded.note,granted_by=auth.uid(),granted_at=now(),revoked_by=NULL,revoked_at=NULL,updated_by=auth.uid(),updated_at=now();
 INSERT INTO public.super_admin_audit_log(changed_by,section,action,entity,previous_value,new_value,summary) VALUES(auth.uid(),'Project Creators','grant_project_creator',p_user_id::text,v_old,jsonb_build_object('user_id',p_user_id,'is_active',true,'note',nullif(btrim(p_note),'')),'Project creation access granted');
END $$;
REVOKE ALL ON FUNCTION public.grant_project_creator(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_project_creator(uuid,text) TO authenticated;

CREATE FUNCTION public.revoke_project_creator(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_tier1_or_super(auth.uid()) OR NOT public.can_create_project(auth.uid()) THEN RAISE EXCEPTION 'Only active directors or Super Admin can manage project creators' USING ERRCODE='42501'; END IF;
 IF public.is_tier1_or_super(p_user_id) THEN RAISE EXCEPTION 'Super Admin, MD and Directors are always allowed and cannot be revoked'; END IF;
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'Select a granted person'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,63));
 SELECT jsonb_build_object('is_active',is_active,'note',note) INTO v_old FROM public.project_creators WHERE user_id=p_user_id AND is_active FOR UPDATE;
 IF v_old IS NULL THEN RAISE EXCEPTION 'Active project creation grant not found'; END IF;
 UPDATE public.project_creators SET is_active=false,revoked_by=auth.uid(),revoked_at=now(),updated_by=auth.uid(),updated_at=now() WHERE user_id=p_user_id;
 INSERT INTO public.super_admin_audit_log(changed_by,section,action,entity,previous_value,new_value,summary) VALUES(auth.uid(),'Project Creators','revoke_project_creator',p_user_id::text,v_old,jsonb_build_object('user_id',p_user_id,'is_active',false),'Project creation access revoked');
END $$;
REVOKE ALL ON FUNCTION public.revoke_project_creator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_project_creator(uuid) TO authenticated;

ALTER POLICY "Allowed roles can create projects" ON public.projects WITH CHECK(public.can_create_project(auth.uid()));

CREATE FUNCTION public.create_project(p_payload jsonb,p_phone text,p_email text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.projects; v_id uuid; v_module uuid; v_phone text; i integer; v_count integer; v_panels integer;
 v_stages text[]:=ARRAY['Main Frame','Sub-Frame','MEP Rough-In','Insulation','Drywall','Paint','MEP Final','Windows & Doors','Finishing','QC Inspection','Dispatch'];
BEGIN
 IF NOT public.can_create_project(auth.uid()) THEN RAISE EXCEPTION 'You are not allowed to create projects' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('name','client_name','project_architect_id','division','production_system','module_count','panel_count','contract_value','start_date','est_completion','client_work_order_id','wo_line_item_ref','location','site_lat','site_lng','site_radius')) OR EXISTS(SELECT 1 FROM jsonb_each(p_payload) e WHERE jsonb_typeof(e.value) IN ('object','array')) THEN RAISE EXCEPTION 'Invalid project creation fields'; END IF;
 SELECT * INTO p FROM jsonb_populate_record(NULL::public.projects,p_payload);
 IF nullif(btrim(p.name),'') IS NULL OR nullif(btrim(p.client_name),'') IS NULL THEN RAISE EXCEPTION 'Project and client names are required'; END IF;
 PERFORM public._validate_project_location(p.location,p.site_lat,p.site_lng,p.site_radius);
 v_phone:=public._normalise_project_phone(p_phone); PERFORM public._validate_project_email(p_email);
 IF p.start_date IS NULL OR p.est_completion IS NULL THEN RAISE EXCEPTION 'Contract Start and Expected Delivery dates are required'; END IF;
 IF p.project_architect_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles a WHERE a.id=p.project_architect_id AND a.is_active=true AND NOT coalesce(a.is_archived,false)) THEN RAISE EXCEPTION 'Assign an active Project Architect'; END IF;
 IF p.division IS NULL OR p.division NOT IN ('Habitainer','ADS','Contractor WO') OR p.production_system IS NULL OR p.production_system NOT IN ('modular','panelised','hybrid') THEN RAISE EXCEPTION 'Invalid division or production system'; END IF;
 v_count:=coalesce(p.module_count,0); v_panels:=coalesce(p.panel_count,0);
 IF v_count<0 OR v_panels<0 OR coalesce(p.contract_value,0)<0 THEN RAISE EXCEPTION 'Counts and contract value cannot be negative'; END IF;
 IF p.division='Contractor WO' AND NOT EXISTS(SELECT 1 FROM public.client_work_orders w WHERE w.id=p.client_work_order_id AND w.acceptance_signed AND NOT coalesce(w.is_archived,false)) THEN RAISE EXCEPTION 'Select a Work Order with a signed Acceptance Statement'; END IF;
 IF p.division<>'Contractor WO' AND p.client_work_order_id IS NOT NULL THEN RAISE EXCEPTION 'Work Orders must use Contractor WO division'; END IF;
 INSERT INTO public.projects(name,client_name,project_architect_id,division,production_system,module_count,panel_count,contract_value,start_date,est_completion,client_work_order_id,wo_line_item_ref,location,site_lat,site_lng,site_radius,client_phone,client_email,status,created_by,updated_by)
 VALUES(btrim(p.name),btrim(p.client_name),p.project_architect_id,p.division,p.production_system,v_count,v_panels,coalesce(p.contract_value,0),p.start_date,p.est_completion,p.client_work_order_id,p.wo_line_item_ref,btrim(p.location),p.site_lat,p.site_lng,p.site_radius,v_phone,btrim(p_email),'Active',auth.uid(),auth.uid()) RETURNING id INTO v_id;
 FOR i IN 1..v_count LOOP
  INSERT INTO public.modules(project_id,name,module_type,current_stage,production_status,created_by,updated_by) VALUES(v_id,'Module '||i,'standard','Main Frame','not_started',auth.uid(),auth.uid()) RETURNING id INTO v_module;
  INSERT INTO public.production_stages(module_id,stage_name,stage_order,status) SELECT v_module,s,ord::integer,'pending' FROM unnest(v_stages) WITH ORDINALITY AS x(s,ord);
 END LOOP;
 IF v_panels>0 THEN
  INSERT INTO public.modules(project_id,name,module_type,current_stage,production_status,created_by,updated_by) VALUES(v_id,'Panel Production','standard','Main Frame','not_started',auth.uid(),auth.uid()) RETURNING id INTO v_module;
  INSERT INTO public.panels(module_id,panel_code,panel_type,current_stage,production_status,created_by) SELECT v_module,'Panel '||n,'wall','Main Frame','not_started',auth.uid() FROM generate_series(1,v_panels) n;
 END IF;
 INSERT INTO public.super_admin_audit_log(changed_by,section,action,entity,new_value,summary) VALUES(auth.uid(),'Projects','create_project',v_id::text,jsonb_build_object('status','Active','module_count',v_count,'panel_count',v_panels),'Project created with initial modules, stages and panels');
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.create_project(jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project(jsonb,text,text) TO authenticated;

-- Preserve legacy requests and their existing approval checks, but never allow their privileged writers to bypass the new creation entitlement.
DO $$ DECLARE d text; marker text; BEGIN
 d:=pg_get_functiondef('public.approve_project_request(uuid)'::regprocedure);
 marker:='SELECT * INTO r FROM public.approval_requests WHERE id=p_request_id FOR UPDATE;';
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'Legacy approval guard marker missing'; END IF;
 EXECUTE replace(d,marker,'IF NOT public.can_create_project(auth.uid()) THEN RAISE EXCEPTION ''You are not allowed to create projects'' USING ERRCODE=''42501''; END IF; '||marker);
 d:=pg_get_functiondef('public.raise_project_request(jsonb,text,text)'::regprocedure);
 marker:='IF auth.uid() IS NULL OR NOT (public.is_tier1_or_super(auth.uid()) OR public.has_role(auth.uid(),''planning_head'')) THEN';
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'Legacy request guard marker missing'; END IF;
 EXECUTE replace(d,marker,'IF NOT public.can_create_project(auth.uid()) THEN');
END $$;