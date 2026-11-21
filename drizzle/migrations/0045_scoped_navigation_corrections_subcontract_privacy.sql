ALTER POLICY "Authenticated read role access" ON public.role_feature_access USING (public.is_tier1_or_super(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role::text=role_feature_access.role));
ALTER POLICY "MD manages role access" ON public.role_feature_access USING (public.is_tier1_or_super(auth.uid())) WITH CHECK (public.is_tier1_or_super(auth.uid()));
REVOKE SELECT ON public.site_report_quantities FROM PUBLIC, anon, authenticated;
REVOKE SELECT (amount_inr, rate_used, rate_id) ON public.site_report_quantities FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, report_id, project_id, boq_item_id, today_qty, remarks, created_at, updated_at, created_by, updated_by, contractor_id, extra_work_description, unit) ON public.site_report_quantities TO authenticated;
GRANT ALL ON public.site_report_quantities TO service_role;

-- Catalog-derived DDL preserves the untouched parts of the reviewed functions.
-- These commands run once as migration DDL, never from a caller's correction values.
DO $migration$
DECLARE d text; old_fragment text; new_fragment text;
BEGIN
 SELECT pg_get_functiondef('public.can_edit_with_reason(uuid,text,uuid)'::regprocedure) INTO d;
 IF strpos(d,'BEGIN'||chr(10)||'  SELECT * INTO v_me')=0 THEN RAISE EXCEPTION 'Unexpected correction permission definition'; END IF;
 d:=replace(d,'BEGIN'||chr(10)||'  SELECT * INTO v_me', 'BEGIN'||chr(10)||'  IF _user_id IS DISTINCT FROM auth.uid() OR _table NOT IN (''site_diary'',''daily_measurements'',''qc_inspections'',''marketing_funnel_monthly'',''call_funnel_monthly'') THEN RETURN false; END IF;'||chr(10)||'  SELECT * INTO v_me');
 d:=replace(d,'v_me.role IN (''super_admin'',''managing_director'',''sales_director'', ''finance_director'', ''architecture_director'')','public.is_tier1_or_super(_user_id)');
 d:=replace(d,'v_me.role IN (''super_admin'',''managing_director'',''head_operations'', ''finance_director'', ''sales_director'', ''architecture_director'')','(public.is_tier1_or_super(_user_id) OR public.has_role(_user_id,''head_operations''))');
 d:=replace(d,'v_me.role IN (''production_head'',''qc_inspector'')','(public.has_role(_user_id,''production_head'') OR public.has_role(_user_id,''qc_inspector''))');
 d:=replace(d,'v_me.role IN (''site_installation_mgr'',''head_of_projects'')','(public.has_role(_user_id,''site_installation_mgr'') OR public.has_role(_user_id,''head_of_projects''))');
 d:=replace(d,'v_me.role IN (''production_head'')','public.has_role(_user_id,''production_head'')');
 IF strpos(d,'v_me.role IN')>0 THEN RAISE EXCEPTION 'Unreviewed correction role expression'; END IF;
 EXECUTE d;

 SELECT pg_get_functiondef('public.apply_record_edit(text,uuid,jsonb,text,text)'::regprocedure) INTO d;
 d:=replace(d,'  v_location text;','  v_location text;'||chr(10)||'  v_current jsonb;');
 old_fragment:=$old$    EXECUTE format('SELECT (%I)::text FROM public.%I WHERE id = $1', v_key, _table)
      INTO v_old USING _record_id;

    IF v_old IS DISTINCT FROM v_new THEN
      EXECUTE format('UPDATE public.%I SET %I = $1::text::%s WHERE id = $2',
        _table, v_key,
        (SELECT data_type FROM information_schema.columns
          WHERE table_schema='public' AND table_name=_table AND column_name=v_key))
        USING v_new, _record_id;$old$;
 new_fragment:=$new$    CASE _table
      WHEN 'site_diary' THEN SELECT to_jsonb(t) INTO v_current FROM public.site_diary t WHERE id=_record_id FOR UPDATE;
      WHEN 'daily_measurements' THEN SELECT to_jsonb(t) INTO v_current FROM public.daily_measurements t WHERE id=_record_id FOR UPDATE;
      WHEN 'measurement_line_items' THEN SELECT to_jsonb(t) INTO v_current FROM public.measurement_line_items t WHERE id=_record_id FOR UPDATE;
      WHEN 'qc_inspections' THEN SELECT to_jsonb(t) INTO v_current FROM public.qc_inspections t WHERE id=_record_id FOR UPDATE;
      WHEN 'qc_inspection_items' THEN SELECT to_jsonb(t) INTO v_current FROM public.qc_inspection_items t WHERE id=_record_id FOR UPDATE;
      WHEN 'marketing_funnel_monthly' THEN SELECT to_jsonb(t) INTO v_current FROM public.marketing_funnel_monthly t WHERE id=_record_id FOR UPDATE;
      WHEN 'call_funnel_monthly' THEN SELECT to_jsonb(t) INTO v_current FROM public.call_funnel_monthly t WHERE id=_record_id FOR UPDATE;
      ELSE RAISE EXCEPTION 'Editing not supported';
    END CASE;
    IF v_current IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
    v_old:=v_current->>v_key;
    IF v_old IS DISTINCT FROM v_new THEN
      CASE _table
        WHEN 'site_diary' THEN UPDATE public.site_diary SET (notes, daily_summary, blockers, manpower_count, weather_condition, power_cut_duration, milestone_tag, client_visit_name, client_visit_purpose, client_visit_notes) =
          (SELECT x.notes, x.daily_summary, x.blockers, x.manpower_count, x.weather_condition, x.power_cut_duration, x.milestone_tag, x.client_visit_name, x.client_visit_purpose, x.client_visit_notes FROM jsonb_populate_record(NULL::public.site_diary,v_current||jsonb_build_object(v_key,v_new)) x) WHERE id=_record_id;
        WHEN 'daily_measurements' THEN UPDATE public.daily_measurements SET (notes, trade, team_label, stage) =
          (SELECT x.notes, x.trade, x.team_label, x.stage FROM jsonb_populate_record(NULL::public.daily_measurements,v_current||jsonb_build_object(v_key,v_new)) x) WHERE id=_record_id;
        WHEN 'measurement_line_items' THEN UPDATE public.measurement_line_items SET (today_qty, labour_cost_today, material_cost_today) =
          (SELECT x.today_qty, x.labour_cost_today, x.material_cost_today FROM jsonb_populate_record(NULL::public.measurement_line_items,v_current||jsonb_build_object(v_key,v_new)) x) WHERE id=_record_id;
        WHEN 'qc_inspections' THEN UPDATE public.qc_inspections SET (status, dispatch_decision) =
          (SELECT x.status, x.dispatch_decision FROM jsonb_populate_record(NULL::public.qc_inspections,v_current||jsonb_build_object(v_key,v_new)) x) WHERE id=_record_id;
        WHEN 'qc_inspection_items' THEN UPDATE public.qc_inspection_items SET (result, notes) =
          (SELECT x.result, x.notes FROM jsonb_populate_record(NULL::public.qc_inspection_items,v_current||jsonb_build_object(v_key,v_new)) x) WHERE id=_record_id;
        WHEN 'marketing_funnel_monthly' THEN UPDATE public.marketing_funnel_monthly SET (total_leads, qualified_leads, model_home_visits, proposals_shared, meta_ad_spend, webinar_spend, leads_instagram, leads_youtube, leads_website, leads_webinar, leads_direct, instagram_followers, instagram_views, instagram_reach, youtube_subscribers, youtube_views, webinar_attendees) =
          (SELECT x.total_leads, x.qualified_leads, x.model_home_visits, x.proposals_shared, x.meta_ad_spend, x.webinar_spend, x.leads_instagram, x.leads_youtube, x.leads_website, x.leads_webinar, x.leads_direct, x.instagram_followers, x.instagram_views, x.instagram_reach, x.youtube_subscribers, x.youtube_views, x.webinar_attendees FROM jsonb_populate_record(NULL::public.marketing_funnel_monthly,v_current||jsonb_build_object(v_key,v_new)) x) WHERE id=_record_id;
        WHEN 'call_funnel_monthly' THEN UPDATE public.call_funnel_monthly SET (leads_total, calls_made, calls_answered, calls_rnr, calls_qualified, visits_from_qualified, loss_reason, loss_reason_detail) =
          (SELECT x.leads_total, x.calls_made, x.calls_answered, x.calls_rnr, x.calls_qualified, x.visits_from_qualified, x.loss_reason, x.loss_reason_detail FROM jsonb_populate_record(NULL::public.call_funnel_monthly,v_current||jsonb_build_object(v_key,v_new)) x) WHERE id=_record_id;
        ELSE RAISE EXCEPTION 'Editing not supported';
      END CASE;$new$;
 IF strpos(d,old_fragment)=0 THEN RAISE EXCEPTION 'Unexpected correction update definition'; END IF;
 d:=replace(d,old_fragment,new_fragment);
 old_fragment:=$old$  IF _table IN ('site_diary','daily_measurements','qc_inspections') THEN
    EXECUTE format('UPDATE public.%I SET updated_at = now() WHERE id = $1', _table) USING _record_id;
  ELSIF _table IN ('marketing_funnel_monthly','call_funnel_monthly') THEN
    EXECUTE format('UPDATE public.%I SET updated_at = now(), updated_by = $2 WHERE id = $1', _table) USING _record_id, v_user;
  END IF;$old$;
 new_fragment:=$new$  CASE _table
    WHEN 'site_diary' THEN UPDATE public.site_diary SET updated_at=now() WHERE id=_record_id;
    WHEN 'daily_measurements' THEN UPDATE public.daily_measurements SET updated_at=now() WHERE id=_record_id;
    WHEN 'qc_inspections' THEN UPDATE public.qc_inspections SET updated_at=now() WHERE id=_record_id;
    WHEN 'marketing_funnel_monthly' THEN UPDATE public.marketing_funnel_monthly SET updated_at=now(),updated_by=v_user WHERE id=_record_id;
    WHEN 'call_funnel_monthly' THEN UPDATE public.call_funnel_monthly SET updated_at=now(),updated_by=v_user WHERE id=_record_id;
    ELSE NULL;
  END CASE;$new$;
 IF strpos(d,old_fragment)=0 THEN RAISE EXCEPTION 'Unexpected correction timestamp definition'; END IF;
 d:=replace(d,old_fragment,new_fragment);
 IF strpos(d,'EXECUTE')>0 THEN RAISE EXCEPTION 'Dynamic commands remain in correction function'; END IF;
 EXECUTE d;

 SELECT pg_get_functiondef('public.get_site_report(uuid,date)'::regprocedure) INTO d;
 d:=replace(d,'v_rates boolean;','v_rates boolean; v_costs boolean;');
 old_fragment:='  v_rates := public.can_read_subcontract_rates(auth.uid(), p_project_id);';
 IF strpos(d,old_fragment)=0 THEN RAISE EXCEPTION 'Unexpected report permission definition'; END IF;
 d:=replace(d,old_fragment,old_fragment||chr(10)||'  v_costs := v_rates AND public.can_view_running_bill(auth.uid());');
 old_fragment:=$old$    'quantities', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'boq_item_id',boq_item_id,'contractor_id',contractor_id,'rate_id',rate_id,
        'extra_work_description',extra_work_description,'unit',unit,'today_qty',today_qty,'remarks',remarks,
        'rate_used',CASE WHEN v_rates THEN rate_used END,'amount_inr',CASE WHEN v_rates THEN amount_inr END) ORDER BY created_at)
      FROM public.site_report_quantities WHERE report_id=r.id),'[]'::jsonb),$old$;
 new_fragment:=$new$    'quantities', coalesce((SELECT jsonb_agg((jsonb_build_object('id',id,'boq_item_id',boq_item_id,'contractor_id',contractor_id,
        'extra_work_description',extra_work_description,'unit',unit,'today_qty',today_qty,'remarks',remarks) || CASE WHEN v_costs THEN jsonb_build_object('rate_id',rate_id,'rate_used',rate_used,'amount_inr',amount_inr) ELSE '{}'::jsonb END) ORDER BY created_at)
      FROM public.site_report_quantities WHERE report_id=r.id),'[]'::jsonb),$new$;
 IF strpos(d,old_fragment)=0 THEN RAISE EXCEPTION 'Unexpected report quantity projection'; END IF;
 d:=replace(d,old_fragment,new_fragment);
 old_fragment:=$old$    'rates', CASE WHEN v_rates THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'contractor_id',s.contractor_id,'boq_item_id',s.boq_item_id,
        'work_description',s.work_description,'unit',s.unit,'rate_type',s.rate_type,'package_qty',s.package_qty,'lump_sum_inr',s.lump_sum_inr,
        'effective_rate',public.subcontract_effective_rate(s.rate_type,s.rate_inr,s.lump_sum_inr,s.package_qty),
        'used_qty',(SELECT coalesce(sum(q.today_qty),0) FROM public.site_report_quantities q JOIN public.daily_measurements d ON d.id=q.report_id
           WHERE q.rate_id=s.id AND d.id IS DISTINCT FROM r.id AND d.is_archived=false AND d.trade='daily_site_report' AND d.report_status='submitted')))
      FROM public.subcontract_rates s WHERE s.project_id=p_project_id AND s.is_active),'[]'::jsonb) ELSE '[]'::jsonb END,$old$;
 new_fragment:=$new$    'rates', CASE WHEN v_rates THEN coalesce((SELECT jsonb_agg(jsonb_build_object('contractor_id',s.contractor_id,'boq_item_id',s.boq_item_id,
        'work_description',s.work_description,'unit',s.unit,'rate_type',s.rate_type,'package_qty',s.package_qty,
        'used_qty',(SELECT coalesce(sum(q.today_qty),0) FROM public.site_report_quantities q JOIN public.daily_measurements d ON d.id=q.report_id
           WHERE q.rate_id=s.id AND d.id IS DISTINCT FROM r.id AND d.is_archived=false AND d.trade='daily_site_report' AND d.report_status='submitted')) || CASE WHEN v_costs THEN jsonb_build_object('id',s.id,'lump_sum_inr',s.lump_sum_inr,'effective_rate',public.subcontract_effective_rate(s.rate_type,s.rate_inr,s.lump_sum_inr,s.package_qty)) ELSE '{}'::jsonb END)
      FROM public.subcontract_rates s WHERE s.project_id=p_project_id AND s.is_active),'[]'::jsonb) ELSE '[]'::jsonb END,$new$;
 IF strpos(d,old_fragment)=0 THEN RAISE EXCEPTION 'Unexpected report rate projection'; END IF;
 d:=replace(d,old_fragment,new_fragment);
 d:=replace(d,'''can_see_rates'',v_rates','''can_see_rates'',v_costs');
 EXECUTE d;
END $migration$;
REVOKE EXECUTE ON FUNCTION public.apply_record_edit(text,uuid,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_record_edit(text,uuid,jsonb,text,text) TO authenticated, service_role;