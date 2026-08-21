-- 1) Narrow submit access for sales executives on the two funnel tables only
CREATE POLICY "Sales execs submit marketing funnel"
ON public.marketing_funnel_monthly FOR INSERT TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'sales_executive'::app_role AND created_by = auth.uid());

CREATE POLICY "Sales execs update own marketing funnel"
ON public.marketing_funnel_monthly FOR UPDATE TO authenticated
USING (get_user_role(auth.uid()) = 'sales_executive'::app_role AND created_by = auth.uid())
WITH CHECK (get_user_role(auth.uid()) = 'sales_executive'::app_role AND created_by = auth.uid());

CREATE POLICY "Sales execs submit call funnel"
ON public.call_funnel_monthly FOR INSERT TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'sales_executive'::app_role AND created_by = auth.uid());

CREATE POLICY "Sales execs update own call funnel"
ON public.call_funnel_monthly FOR UPDATE TO authenticated
USING (get_user_role(auth.uid()) = 'sales_executive'::app_role AND created_by = auth.uid())
WITH CHECK (get_user_role(auth.uid()) = 'sales_executive'::app_role AND created_by = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.marketing_funnel_monthly TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.call_funnel_monthly TO authenticated;

-- 2) Anomaly notification: 100% answered AND 0 RNR
CREATE OR REPLACE FUNCTION public.notify_call_funnel_anomaly()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.data_quality_flag IS TRUE
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.data_quality_flag, false) IS DISTINCT FROM true
          OR OLD.calls_made IS DISTINCT FROM NEW.calls_made
          OR OLD.calls_answered IS DISTINCT FROM NEW.calls_answered
          OR OLD.calls_rnr IS DISTINCT FROM NEW.calls_rnr) THEN
    INSERT INTO public.notifications(recipient_id, type, category, priority, title, body, related_table, related_id)
    SELECT p.auth_user_id, 'data_quality_flag', 'sales', 'high',
           'Call funnel data needs review - ' || to_char(NEW.month, 'Mon YYYY'),
           'Every call is recorded as answered with zero RNR (' || NEW.calls_made || ' calls). '
             || 'This pattern usually indicates a data-capture artefact rather than a real result.',
           'call_funnel_monthly', NEW.id
    FROM public.profiles p
    WHERE p.is_active = true
      AND p.auth_user_id IS NOT NULL
      AND p.auth_user_id IS DISTINCT FROM auth.uid()
      AND p.role IN ('sales_director'::app_role, 'managing_director'::app_role, 'super_admin'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_call_funnel_anomaly ON public.call_funnel_monthly;
CREATE TRIGGER trg_notify_call_funnel_anomaly
AFTER INSERT OR UPDATE ON public.call_funnel_monthly
FOR EACH ROW EXECUTE FUNCTION public.notify_call_funnel_anomaly();

-- 3) Extend Edit-with-Reason permission to the two funnel tables
CREATE OR REPLACE FUNCTION public.can_edit_with_reason(_user_id uuid, _table text, _record_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_submitter uuid;
  v_created timestamptz;
  v_location text;
  v_me public.profiles%ROWTYPE;
  v_sub public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_me FROM public.profiles WHERE auth_user_id = _user_id AND is_active = true;
  IF v_me.id IS NULL THEN RETURN false; END IF;

  IF _table IN ('marketing_funnel_monthly','call_funnel_monthly') THEN
    IF v_me.role IN ('super_admin','managing_director','sales_director') THEN RETURN true; END IF;
    IF _table = 'marketing_funnel_monthly' THEN
      SELECT created_by, created_at INTO v_submitter, v_created FROM public.marketing_funnel_monthly WHERE id = _record_id;
    ELSE
      SELECT created_by, created_at INTO v_submitter, v_created FROM public.call_funnel_monthly WHERE id = _record_id;
    END IF;
    IF v_submitter IS NULL THEN RETURN false; END IF;
    IF v_submitter = _user_id AND v_created > now() - interval '48 hours' THEN RETURN true; END IF;
    SELECT * INTO v_sub FROM public.profiles WHERE auth_user_id = v_submitter;
    IF v_sub.id IS NOT NULL AND (v_sub.reporting_manager_id = v_me.id OR v_sub.secondary_manager_id = v_me.id) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  IF v_me.role IN ('super_admin','managing_director','head_operations') THEN RETURN true; END IF;

  IF _table = 'site_diary' THEN
    SELECT submitted_by_user_id, created_at, 'site' INTO v_submitter, v_created, v_location
    FROM public.site_diary WHERE id = _record_id;
  ELSIF _table = 'daily_measurements' THEN
    SELECT COALESCE(submitted_by, created_by), created_at, COALESCE(location,'factory') INTO v_submitter, v_created, v_location
    FROM public.daily_measurements WHERE id = _record_id;
  ELSIF _table = 'qc_inspections' THEN
    SELECT inspector_id, created_at, 'factory' INTO v_submitter, v_created, v_location
    FROM public.qc_inspections WHERE id = _record_id;
  ELSE
    RETURN false;
  END IF;

  IF v_submitter IS NULL AND v_created IS NULL THEN RETURN false; END IF;

  IF v_submitter = _user_id AND v_created > now() - interval '48 hours' THEN
    RETURN true;
  END IF;

  SELECT * INTO v_sub FROM public.profiles WHERE auth_user_id = v_submitter;
  IF v_sub.id IS NOT NULL AND (v_sub.reporting_manager_id = v_me.id OR v_sub.secondary_manager_id = v_me.id) THEN
    RETURN true;
  END IF;

  IF _table = 'qc_inspections' AND v_me.role IN ('production_head','qc_inspector') THEN RETURN true; END IF;
  IF v_location = 'site' AND v_me.role IN ('site_installation_mgr','head_of_projects') THEN RETURN true; END IF;
  IF v_location <> 'site' AND v_me.role IN ('production_head') THEN RETURN true; END IF;

  RETURN false;
END;
$function$;

-- 4) Extend apply_record_edit to the funnel tables
CREATE OR REPLACE FUNCTION public.apply_record_edit(_table text, _record_id uuid, _changes jsonb, _reason_category text, _reason_detail text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_action uuid := gen_random_uuid();
  v_project uuid;
  v_measurement uuid;
  v_key text;
  v_new text;
  v_old text;
  v_finalized boolean := false;
  v_flagged boolean := false;
  v_allowed text[];
  v_location text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _table NOT IN ('site_diary','daily_measurements','measurement_line_items','qc_inspections','qc_inspection_items','marketing_funnel_monthly','call_funnel_monthly') THEN
    RAISE EXCEPTION 'Editing not supported for %', _table;
  END IF;
  IF _reason_category IS NULL OR _reason_category NOT IN ('mistyped','misread_instrument','wrong_unit','forgot_to_update','other') THEN
    RAISE EXCEPTION 'A valid reason category is required';
  END IF;
  IF _changes IS NULL OR jsonb_typeof(_changes) <> 'object' OR _changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'No changes supplied';
  END IF;

  IF _table = 'measurement_line_items' THEN
    SELECT measurement_id INTO v_measurement FROM public.measurement_line_items WHERE id = _record_id;
    IF NOT public.can_edit_with_reason(v_user, 'daily_measurements', v_measurement) THEN
      RAISE EXCEPTION 'You are not allowed to edit this record';
    END IF;
    SELECT project_id INTO v_project FROM public.daily_measurements WHERE id = v_measurement;
  ELSIF _table = 'qc_inspection_items' THEN
    SELECT inspection_id INTO v_measurement FROM public.qc_inspection_items WHERE id = _record_id;
    IF NOT public.can_edit_with_reason(v_user, 'qc_inspections', v_measurement) THEN
      RAISE EXCEPTION 'You are not allowed to edit this record';
    END IF;
    SELECT project_id INTO v_project FROM public.qc_inspections WHERE id = v_measurement;
  ELSE
    IF NOT public.can_edit_with_reason(v_user, _table, _record_id) THEN
      RAISE EXCEPTION 'Edit window has closed - ask your manager or the role owner to make this correction';
    END IF;
    IF _table = 'site_diary' THEN SELECT project_id INTO v_project FROM public.site_diary WHERE id = _record_id;
    ELSIF _table = 'daily_measurements' THEN SELECT project_id, id INTO v_project, v_measurement FROM public.daily_measurements WHERE id = _record_id;
    ELSIF _table = 'qc_inspections' THEN SELECT project_id INTO v_project FROM public.qc_inspections WHERE id = _record_id;
    END IF;
  END IF;

  v_allowed := CASE _table
    WHEN 'site_diary' THEN ARRAY['notes','daily_summary','blockers','manpower_count','weather_condition','power_cut_duration','milestone_tag','client_visit_name','client_visit_purpose','client_visit_notes']
    WHEN 'daily_measurements' THEN ARRAY['notes','trade','team_label','stage']
    WHEN 'measurement_line_items' THEN ARRAY['today_qty','labour_cost_today','material_cost_today']
    WHEN 'qc_inspections' THEN ARRAY['status','dispatch_decision']
    WHEN 'qc_inspection_items' THEN ARRAY['result','notes']
    WHEN 'marketing_funnel_monthly' THEN ARRAY['total_leads','qualified_leads','model_home_visits','proposals_shared','meta_ad_spend','webinar_spend','leads_instagram','leads_youtube','leads_website','leads_webinar','leads_direct','instagram_followers','instagram_views','instagram_reach','youtube_subscribers','youtube_views','webinar_attendees']
    WHEN 'call_funnel_monthly' THEN ARRAY['leads_total','calls_made','calls_answered','calls_rnr','calls_qualified','visits_from_qualified','loss_reason','loss_reason_detail']
  END;

  IF _table IN ('measurement_line_items','daily_measurements') AND v_project IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.project_billing_milestones
      WHERE project_id = v_project
        AND (billed_date IS NOT NULL OR lower(COALESCE(status,'')) IN ('billed','invoiced','received','paid'))
    ) INTO v_finalized;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(_changes) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Field % is not editable', v_key;
    END IF;
    v_new := _changes -> v_key ->> 'new';
    EXECUTE format('SELECT (%I)::text FROM public.%I WHERE id = $1', v_key, _table)
      INTO v_old USING _record_id;

    IF v_old IS DISTINCT FROM v_new THEN
      EXECUTE format('UPDATE public.%I SET %I = $1::text::%s WHERE id = $2',
        _table, v_key,
        (SELECT data_type FROM information_schema.columns
          WHERE table_schema='public' AND table_name=_table AND column_name=v_key))
        USING v_new, _record_id;

      INSERT INTO public.edit_history(edit_action_id, record_table, record_id, project_id, field_name,
        old_value, new_value, reason_category, reason_detail, downstream_flagged, edited_by)
      VALUES (v_action, _table, _record_id, v_project, v_key, v_old, v_new,
        _reason_category, _reason_detail, v_finalized, v_user);
      v_flagged := true;
    END IF;
  END LOOP;

  IF NOT v_flagged THEN RETURN jsonb_build_object('changed', false); END IF;

  IF _table IN ('site_diary','daily_measurements','qc_inspections') THEN
    EXECUTE format('UPDATE public.%I SET updated_at = now() WHERE id = $1', _table) USING _record_id;
  ELSIF _table IN ('marketing_funnel_monthly','call_funnel_monthly') THEN
    EXECUTE format('UPDATE public.%I SET updated_at = now(), updated_by = $2 WHERE id = $1', _table) USING _record_id, v_user;
  END IF;

  IF _table IN ('measurement_line_items','daily_measurements') AND v_measurement IS NOT NULL THEN
    IF v_finalized THEN
      UPDATE public.daily_measurements
        SET wip_needs_review = true,
            wip_review_reason = 'Source measurement edited after billing was finalized - manual review required'
        WHERE id = v_measurement;
      UPDATE public.project_billing_milestones
        SET needs_manual_review = true,
            review_reason = 'Underlying measurement data was corrected after billing',
            review_flagged_at = now()
        WHERE project_id = v_project
          AND (billed_date IS NOT NULL OR lower(COALESCE(status,'')) IN ('billed','invoiced','received','paid'));
    ELSE
      UPDATE public.measurement_line_items
        SET wip_today = COALESCE(labour_cost_today,0) + COALESCE(material_cost_today,0)
        WHERE measurement_id = v_measurement;
      UPDATE public.daily_measurements dm
        SET total_wip_today = COALESCE((SELECT SUM(wip_today) FROM public.measurement_line_items WHERE measurement_id = dm.id),0)
        WHERE dm.id = v_measurement;
    END IF;
  END IF;

  INSERT INTO public.notifications(recipient_id, type, category, priority, title, body, related_table, related_id)
  SELECT p.auth_user_id, 'record_edited', 'data_correction',
         CASE WHEN v_finalized THEN 'high' ELSE 'normal' END,
         'Record corrected: ' || _table,
         'A ' || _table || ' record was edited (' || _reason_category || ')'
           || COALESCE(' - ' || _reason_detail, '')
           || CASE WHEN v_finalized THEN ' [Downstream billing flagged for manual review]' ELSE '' END,
         _table, _record_id
  FROM public.profiles p
  WHERE p.is_active = true
    AND p.auth_user_id IS DISTINCT FROM v_user
    AND p.role::text = ANY (
      CASE
        WHEN _table IN ('marketing_funnel_monthly','call_funnel_monthly') THEN ARRAY['sales_director']
        WHEN _table LIKE 'qc%' THEN ARRAY['production_head','head_operations']
        WHEN _table = 'site_diary' THEN ARRAY['site_installation_mgr','head_of_projects']
        ELSE ARRAY['production_head','head_operations']
      END
    );

  RETURN jsonb_build_object('changed', true, 'edit_action_id', v_action, 'downstream_flagged', v_finalized);
END;
$function$;