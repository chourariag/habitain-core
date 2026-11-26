# BOQ-1b pre-change source inspection

## Quantity and rate columns
```text
[map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:boq_work_location_log]
map[column_default:<nil> column_name:boq_item_id data_type:uuid table_name:boq_work_location_log]
map[column_default:<nil> column_name:old_location data_type:text table_name:boq_work_location_log]
map[column_default:<nil> column_name:new_location data_type:text table_name:boq_work_location_log]
map[column_default:auth.uid() column_name:created_by data_type:uuid table_name:boq_work_location_log]
map[column_default:auth.uid() column_name:updated_by data_type:uuid table_name:boq_work_location_log]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:boq_work_location_log]
map[column_default:now() column_name:updated_at data_type:timestamp with time zone table_name:boq_work_location_log]
map[column_default:false column_name:is_archived data_type:boolean table_name:boq_work_location_log]
map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:daily_measurements]
map[column_default:<nil> column_name:project_id data_type:uuid table_name:daily_measurements]
map[column_default:<nil> column_name:module_id data_type:uuid table_name:daily_measurements]
map[column_default:<nil> column_name:stage data_type:text table_name:daily_measurements]
map[column_default:CURRENT_DATE column_name:measurement_date data_type:date table_name:daily_measurements]
map[column_default:<nil> column_name:location data_type:text table_name:daily_measurements]
map[column_default:'general'::text column_name:trade data_type:text table_name:daily_measurements]
map[column_default:<nil> column_name:team_label data_type:text table_name:daily_measurements]
map[column_default:<nil> column_name:notes data_type:text table_name:daily_measurements]
map[column_default:true column_name:is_locked data_type:boolean table_name:daily_measurements]
map[column_default:<nil> column_name:unlock_reason data_type:text table_name:daily_measurements]
map[column_default:<nil> column_name:unlocked_by data_type:uuid table_name:daily_measurements]
map[column_default:<nil> column_name:unlocked_at data_type:timestamp with time zone table_name:daily_measurements]
map[column_default:'[]'::jsonb column_name:anomaly_flags data_type:jsonb table_name:daily_measurements]
map[column_default:<nil> column_name:submitted_by data_type:uuid table_name:daily_measurements]
map[column_default:false column_name:is_archived data_type:boolean table_name:daily_measurements]
map[column_default:<nil> column_name:created_by data_type:uuid table_name:daily_measurements]
map[column_default:<nil> column_name:updated_by data_type:uuid table_name:daily_measurements]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:daily_measurements]
map[column_default:now() column_name:updated_at data_type:timestamp with time zone table_name:daily_measurements]
map[column_default:0 column_name:total_wip_today data_type:numeric table_name:daily_measurements]
map[column_default:<nil> column_name:submitted_at data_type:timestamp with time zone table_name:daily_measurements]
map[column_default:<nil> column_name:reviewed_by data_type:uuid table_name:daily_measurements]
map[column_default:false column_name:wip_needs_review data_type:boolean table_name:daily_measurements]
map[column_default:<nil> column_name:wip_review_reason data_type:text table_name:daily_measurements]
map[column_default:<nil> column_name:report_status data_type:text table_name:daily_measurements]
map[column_default:false column_name:site_clean data_type:boolean table_name:daily_measurements]
map[column_default:<nil> column_name:site_clean_photo_path data_type:text table_name:daily_measurements]
map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:factory_daily_reports]
map[column_default:<nil> column_name:report_date data_type:date table_name:factory_daily_reports]
map[column_default:'draft'::text column_name:status data_type:text table_name:factory_daily_reports]
map[column_default:<nil> column_name:notes data_type:text table_name:factory_daily_reports]
map[column_default:<nil> column_name:submitted_by data_type:uuid table_name:factory_daily_reports]
map[column_default:<nil> column_name:submitted_at data_type:timestamp with time zone table_name:factory_daily_reports]
map[column_default:false column_name:is_archived data_type:boolean table_name:factory_daily_reports]
map[column_default:auth.uid() column_name:created_by data_type:uuid table_name:factory_daily_reports]
map[column_default:auth.uid() column_name:updated_by data_type:uuid table_name:factory_daily_reports]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:factory_daily_reports]
map[column_default:now() column_name:updated_at data_type:timestamp with time zone table_name:factory_daily_reports]
map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:factory_report_quantities]
map[column_default:<nil> column_name:report_id data_type:uuid table_name:factory_report_quantities]
map[column_default:<nil> column_name:module_id data_type:uuid table_name:factory_report_quantities]
map[column_default:<nil> column_name:stage data_type:text table_name:factory_report_quantities]
map[column_default:<nil> column_name:boq_item_id data_type:uuid table_name:factory_report_quantities]
map[column_default:<nil> column_name:contractor_id data_type:uuid table_name:factory_report_quantities]
map[column_default:<nil> column_name:rate_id data_type:uuid table_name:factory_report_quantities]
map[column_default:<nil> column_name:unit data_type:text table_name:factory_report_quantities]
map[column_default:<nil> column_name:today_qty data_type:numeric table_name:factory_report_quantities]
map[column_default:<nil> column_name:rate_used data_type:numeric table_name:factory_report_quantities]
map[column_default:<nil> column_name:amount_inr data_type:numeric table_name:factory_report_quantities]
map[column_default:<nil> column_name:remarks data_type:text table_name:factory_report_quantities]
map[column_default:false column_name:is_archived data_type:boolean table_name:factory_report_quantities]
map[column_default:auth.uid() column_name:created_by data_type:uuid table_name:factory_report_quantities]
map[column_default:auth.uid() column_name:updated_by data_type:uuid table_name:factory_report_quantities]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:factory_report_quantities]
map[column_default:now() column_name:updated_at data_type:timestamp with time zone table_name:factory_report_quantities]
map[column_default:<nil> column_name:material_rate_used data_type:numeric table_name:factory_report_quantities]
map[column_default:<nil> column_name:material_amount_inr data_type:numeric table_name:factory_report_quantities]
map[column_default:<nil> column_name:material_rate_missing data_type:boolean table_name:factory_report_quantities]
map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:measurement_line_items]
map[column_default:<nil> column_name:measurement_id data_type:uuid table_name:measurement_line_items]
map[column_default:<nil> column_name:boq_item_id data_type:uuid table_name:measurement_line_items]
map[column_default:0 column_name:today_qty data_type:numeric table_name:measurement_line_items]
map[column_default:0 column_name:cumulative_qty_snapshot data_type:numeric table_name:measurement_line_items]
map[column_default:0 column_name:value_today_snapshot data_type:numeric table_name:measurement_line_items]
map[column_default:0 column_name:pct_complete_snapshot data_type:numeric table_name:measurement_line_items]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:measurement_line_items]
map[column_default:0 column_name:labour_cost_today data_type:numeric table_name:measurement_line_items]
map[column_default:0 column_name:material_cost_today data_type:numeric table_name:measurement_line_items]
map[column_default:0 column_name:wip_today data_type:numeric table_name:measurement_line_items]
map[column_default:'{}'::text[] column_name:photo_urls data_type:ARRAY table_name:measurement_line_items]
map[column_default:<nil> column_name:stage_name data_type:text table_name:measurement_line_items]
map[column_default:<nil> column_name:remarks data_type:text table_name:measurement_line_items]
map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:project_cost_rates]
map[column_default:<nil> column_name:project_id data_type:uuid table_name:project_cost_rates]
map[column_default:<nil> column_name:boq_item_id data_type:uuid table_name:project_cost_rates]
map[column_default:<nil> column_name:material_rate_inr data_type:numeric table_name:project_cost_rates]
map[column_default:false column_name:is_archived data_type:boolean table_name:project_cost_rates]
map[column_default:auth.uid() column_name:created_by data_type:uuid table_name:project_cost_rates]
map[column_default:auth.uid() column_name:updated_by data_type:uuid table_name:project_cost_rates]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:project_cost_rates]
map[column_default:now() column_name:updated_at data_type:timestamp with time zone table_name:project_cost_rates]
map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:project_cost_rates_log]
map[column_default:<nil> column_name:project_id data_type:uuid table_name:project_cost_rates_log]
map[column_default:<nil> column_name:boq_item_id data_type:uuid table_name:project_cost_rates_log]
map[column_default:<nil> column_name:subcontract_rate_id data_type:uuid table_name:project_cost_rates_log]
map[column_default:<nil> column_name:field data_type:text table_name:project_cost_rates_log]
map[column_default:<nil> column_name:old_value data_type:jsonb table_name:project_cost_rates_log]
map[column_default:<nil> column_name:new_value data_type:jsonb table_name:project_cost_rates_log]
map[column_default:auth.uid() column_name:changed_by data_type:uuid table_name:project_cost_rates_log]
map[column_default:now() column_name:changed_at data_type:timestamp with time zone table_name:project_cost_rates_log]
map[column_default:false column_name:is_archived data_type:boolean table_name:project_cost_rates_log]
map[column_default:auth.uid() column_name:created_by data_type:uuid table_name:project_cost_rates_log]
map[column_default:auth.uid() column_name:updated_by data_type:uuid table_name:project_cost_rates_log]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:project_cost_rates_log]
map[column_default:now() column_name:updated_at data_type:timestamp with time zone table_name:project_cost_rates_log]
map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:site_report_quantities]
map[column_default:<nil> column_name:report_id data_type:uuid table_name:site_report_quantities]
map[column_default:<nil> column_name:project_id data_type:uuid table_name:site_report_quantities]
map[column_default:<nil> column_name:boq_item_id data_type:uuid table_name:site_report_quantities]
map[column_default:0 column_name:today_qty data_type:numeric table_name:site_report_quantities]
map[column_default:<nil> column_name:remarks data_type:text table_name:site_report_quantities]
map[column_default:<nil> column_name:created_by data_type:uuid table_name:site_report_quantities]
map[column_default:<nil> column_name:updated_by data_type:uuid table_name:site_report_quantities]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:site_report_quantities]
map[column_default:now() column_name:updated_at data_type:timestamp with time zone table_name:site_report_quantities]
map[column_default:<nil> column_name:contractor_id data_type:uuid table_name:site_report_quantities]
map[column_default:<nil> column_name:rate_id data_type:uuid table_name:site_report_quantities]
map[column_default:<nil> column_name:extra_work_description data_type:text table_name:site_report_quantities]
map[column_default:<nil> column_name:unit data_type:text table_name:site_report_quantities]
map[column_default:<nil> column_name:rate_used data_type:numeric table_name:site_report_quantities]
map[column_default:<nil> column_name:amount_inr data_type:numeric table_name:site_report_quantities]
map[column_default:<nil> column_name:material_rate_used data_type:numeric table_name:site_report_quantities]
map[column_default:<nil> column_name:material_amount_inr data_type:numeric table_name:site_report_quantities]
map[column_default:<nil> column_name:material_rate_missing data_type:boolean table_name:site_report_quantities]
map[column_default:gen_random_uuid() column_name:id data_type:uuid table_name:subcontract_rates]
map[column_default:<nil> column_name:project_id data_type:uuid table_name:subcontract_rates]
map[column_default:<nil> column_name:contractor_id data_type:uuid table_name:subcontract_rates]
map[column_default:<nil> column_name:rate_type data_type:text table_name:subcontract_rates]
map[column_default:<nil> column_name:boq_item_id data_type:uuid table_name:subcontract_rates]
map[column_default:<nil> column_name:work_description data_type:text table_name:subcontract_rates]
map[column_default:<nil> column_name:unit data_type:text table_name:subcontract_rates]
map[column_default:<nil> column_name:rate_inr data_type:numeric table_name:subcontract_rates]
map[column_default:<nil> column_name:lump_sum_inr data_type:numeric table_name:subcontract_rates]
map[column_default:<nil> column_name:package_qty data_type:numeric table_name:subcontract_rates]
map[column_default:true column_name:is_active data_type:boolean table_name:subcontract_rates]
map[column_default:<nil> column_name:created_by data_type:uuid table_name:subcontract_rates]
map[column_default:<nil> column_name:updated_by data_type:uuid table_name:subcontract_rates]
map[column_default:now() column_name:created_at data_type:timestamp with time zone table_name:subcontract_rates]
map[column_default:now() column_name:updated_at data_type:timestamp with time zone table_name:subcontract_rates]
map[column_default:false column_name:includes_material data_type:boolean table_name:subcontract_rates]]
```

## Existing BOQ writers/mutation and running bill functions
```text
[map[definition:CREATE OR REPLACE FUNCTION public._boq1_rows(p_boq uuid, p_rows jsonb, p_apply boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ DECLARE row jsonb; clean jsonb; result jsonb:='[]'; errors jsonb; warnings jsonb; v_id uuid; v_sno integer; v_qty numeric; v_rate numeric; ordinal integer:=0; BEGIN
IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>500 THEN RAISE EXCEPTION 'Paste up to 500 rows at a time' USING ERRCODE='22023'; END IF;
FOR row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP ordinal:=ordinal+1; errors:='[]'; clean:=NULL; v_id:=NULL;
BEGIN
IF jsonb_typeof(row)<>'object' OR (row - ARRAY['id','sno','item_description','unit','boq_qty','boq_rate','category','scope','work_location','remove'])<>'{}'::jsonb THEN RAISE EXCEPTION 'Only entry fields may be supplied; actor, timestamps and amounts are server-filled' USING ERRCODE='22023'; END IF;
IF nullif(row->>'id','') IS NOT NULL THEN v_id:=(row->>'id')::uuid; IF NOT EXISTS(SELECT 1 FROM public.project_boq_items WHERE id=v_id AND boq_id=p_boq AND entry_managed AND NOT is_archived) THEN RAISE EXCEPTION 'Line is not in this active BOQ' USING ERRCODE='42501'; END IF; END IF;
IF coalesce((row->>'remove')::boolean,false) THEN
IF v_id IS NULL THEN RAISE EXCEPTION 'Choose a saved line to remove'; END IF;
IF p_apply THEN UPDATE public.project_boq_items SET is_archived=true,boq_qty=0,boq_rate=0 WHERE id=v_id; END IF;
result:=result||jsonb_build_array(jsonb_build_object('row',ordinal,'id',v_id,'errors',errors,'warnings','[]'::jsonb)); CONTINUE; END IF;
IF coalesce(row->>'sno','') !~ '^[0-9]+$' OR length(row->>'sno')>9 THEN RAISE EXCEPTION 'Item number must be a positive whole number'; END IF; v_sno:=(row->>'sno')::integer; IF v_sno<=0 THEN RAISE EXCEPTION 'Item number must be positive'; END IF;
IF nullif(btrim(row->>'item_description'),'') IS NULL THEN RAISE EXCEPTION 'Description is required'; END IF; IF nullif(btrim(row->>'unit'),'') IS NULL THEN RAISE EXCEPTION 'Unit is required'; END IF;
IF coalesce(row->>'scope','') NOT IN ('Factory','On-Site Civil','Both','Habitainer') THEN RAISE EXCEPTION 'Select an existing scope'; END IF; IF coalesce(row->>'work_location','') NOT IN ('site','factory') THEN RAISE EXCEPTION 'Select site or factory work location'; END IF;
IF EXISTS(SELECT 1 FROM public.project_boq_items WHERE boq_id=p_boq AND NOT is_archived AND sno=v_sno AND id IS DISTINCT FROM v_id) OR (SELECT count(*) FROM jsonb_array_elements(p_rows) e WHERE e->>'sno'=row->>'sno' AND NOT coalesce((e->>'remove')::boolean,false))>1 THEN RAISE EXCEPTION 'Item number % is repeated; each item number must be unique',v_sno; END IF;
v_qty:=public._boq1_number(row->>'boq_qty','Quantity'); v_rate:=public._boq1_number(row->>'boq_rate','Rate');
clean:=jsonb_build_object('id',v_id,'sno',v_sno,'item_description',btrim(row->>'item_description'),'unit',btrim(row->>'unit'),'boq_qty',v_qty,'boq_rate',v_rate,'category',coalesce(row->>'category',''),'scope',row->>'scope','work_location',row->>'work_location','quantity_missing',nullif(btrim(row->>'boq_qty'),'') IS NULL,'rate_missing',nullif(btrim(row->>'boq_rate'),'') IS NULL,'total_amount',round(v_qty*v_rate,2));
warnings:=public._boq1_warnings(p_boq,clean);
IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) e WHERE e IS DISTINCT FROM row AND public._boq1_normal(e->>'item_description')=public._boq1_normal(row->>'item_description') AND public._boq1_normal(e->>'unit')=public._boq1_normal(row->>'unit')) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(warnings) w WHERE w->>'kind'='duplicate') THEN warnings:=warnings||jsonb_build_array(jsonb_build_object('kind','duplicate','message','Same description and unit appear in this paste batch.')); END IF;
IF p_apply THEN
IF v_id IS NULL THEN INSERT INTO public.project_boq_items(boq_id,sno,item_description,unit,boq_qty,boq_rate,category,scope,work_location,quantity_missing,rate_missing) VALUES(p_boq,v_sno,clean->>'item_description',clean->>'unit',v_qty,v_rate,clean->>'category',clean->>'scope',clean->>'work_location',(clean->>'quantity_missing')::boolean,(clean->>'rate_missing')::boolean) RETURNING id INTO v_id;
ELSE UPDATE public.project_boq_items SET sno=v_sno,item_description=clean->>'item_description',unit=clean->>'unit',boq_qty=v_qty,boq_rate=v_rate,category=clean->>'category',scope=clean->>'scope',work_location=clean->>'work_location',quantity_missing=(clean->>'quantity_missing')::boolean,rate_missing=(clean->>'rate_missing')::boolean WHERE id=v_id; END IF; END IF;
EXCEPTION WHEN OTHERS THEN errors:=jsonb_build_array(SQLERRM); warnings:='[]'; END;
result:=result||jsonb_build_array(jsonb_build_object('row',ordinal,'id',v_id,'values',clean,'errors',errors,'warnings',coalesce(warnings,'[]')));
END LOOP; RETURN result; END $function$
 proname:_boq1_rows]
map[definition:CREATE OR REPLACE FUNCTION public.boq1_can_write(p_project uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT public.boq1_can_read(p_project) AND EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=[REDACTED] AND is_active AND NOT is_archived) AND public.user_has_any_role(auth.uid(),ARRAY['super_admin','managing_director','finance_director','finance_manager','planning_engineer','architecture_director','project_architect','principal_architect','sales_director','planning_head']::public.app_role[]); $function$
 proname:boq1_can_write]
map[definition:CREATE OR REPLACE FUNCTION public.boq1_mutate(p_project uuid, p_action text, p_payload jsonb, p_expected_version integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ DECLARE h public.project_boq%ROWTYPE; bid uuid; rows jsonb; total numeric; n integer; reason text; warning jsonb; line uuid; key text; BEGIN
IF NOT public.boq1_can_write(p_project) THEN RAISE EXCEPTION 'Only an authorised BOQ writer with project access may save this BOQ' USING ERRCODE='42501'; END IF;
PERFORM 1 FROM public.projects WHERE id=p_project AND NOT is_archived FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Project is not active'; END IF;
IF jsonb_typeof(p_payload)<>'object' OR (p_payload-ARRAY['control_total','source_note','rows','reason','line_id','warning_key','note'])<>'{}'::jsonb THEN RAISE EXCEPTION 'Only BOQ entry fields may be supplied' USING ERRCODE='22023'; END IF;
SELECT * INTO h FROM public.project_boq WHERE project_id=p_project AND entry_mode='fresh' AND NOT is_archived FOR UPDATE;
IF p_action='create' THEN IF EXISTS(SELECT 1 FROM public.project_boq WHERE project_id=p_project) THEN RAISE EXCEPTION 'This project already has a BOQ. Existing BOQs remain readable and unchanged; fresh entry is for projects without a BOQ' USING ERRCODE='42501'; END IF;
IF nullif(btrim(p_payload->>'control_total'),'') IS NULL THEN RAISE EXCEPTION 'Type the signed-document control total first'; END IF;
bid:=gen_random_uuid(); PERFORM set_config('hstack.boq_entry',bid::text,true); PERFORM set_config('hstack.boq_action','header_created',true); PERFORM set_config('hstack.boq_reason','',true);
INSERT INTO public.project_boq(id,project_id,entry_mode,control_total,source_note) VALUES(bid,p_project,'fresh',public._boq1_number(p_payload->>'control_total','Control total',true),p_payload->>'source_note'); RETURN public.boq1_get(p_project); END IF;
IF h.id IS NULL THEN RAISE EXCEPTION 'Save the control total and source note before entering lines'; END IF;
IF p_expected_version IS NULL OR p_expected_version<>h.entry_version THEN RAISE EXCEPTION 'This BOQ changed in another window. Reload before saving' USING ERRCODE='40001'; END IF;
IF p_action='preview' THEN RETURN jsonb_build_object('rows',public._boq1_rows(h.id,coalesce(p_payload->'rows','[]'),false)); END IF;
IF h.status='final' AND p_action NOT IN ('revise','acknowledge') THEN RAISE EXCEPTION 'This BOQ is final and locked. Make a balanced revision with a reason' USING ERRCODE='42501'; END IF;
IF p_action='revise' AND h.status<>'final' THEN RAISE EXCEPTION 'Revisions apply only to a final BOQ'; END IF;
reason:=nullif(btrim(p_payload->>'reason'),''); IF p_action='revise' AND reason IS NULL THEN RAISE EXCEPTION 'A reason is required for every revision' USING ERRCODE='22023'; END IF;
PERFORM set_config('hstack.boq_entry',h.id::text,true); PERFORM set_config('hstack.boq_action',p_action,true); PERFORM set_config('hstack.boq_reason',coalesce(reason,''),true);
IF p_action='acknowledge' THEN line:=(p_payload->>'line_id')::uuid; key:=p_payload->>'warning_key'; SELECT w INTO warning FROM public.project_boq_items i CROSS JOIN LATERAL jsonb_array_elements(public._boq1_warnings(h.id,to_jsonb(i))) w WHERE i.id=line AND i.boq_id=h.id AND NOT i.is_archived AND w->>'key'=key; IF warning IS NULL THEN RAISE EXCEPTION 'This warning changed; reload before acknowledging'; END IF;
INSERT INTO public.boq_warning_acknowledgements(project_id,boq_id,line_id,warning_key,warning,note,created_by,updated_by) VALUES(p_project,h.id,line,key,warning,nullif(btrim(p_payload->>'note'),''),auth.uid(),auth.uid()) ON CONFLICT(boq_id,line_id,warning_key) DO NOTHING;
INSERT INTO public.boq_entry_audit(project_id,boq_id,line_id,action,reason,new_value,created_by,updated_by) VALUES(p_project,h.id,line,'warning_acknowledged',p_payload->>'note',warning,auth.uid(),auth.uid());
ELSIF p_action IN ('save','revise') THEN
rows:=public._boq1_rows(h.id,coalesce(p_payload->'rows','[]'),true);
IF p_action='revise' AND EXISTS(SELECT 1 FROM jsonb_array_elements(rows) r WHERE jsonb_array_length(r->'errors')>0) THEN RAISE EXCEPTION 'Revision has line errors: %',rows USING ERRCODE='22023'; END IF;
IF p_payload ? 'control_total' THEN UPDATE public.project_boq SET control_total=public._boq1_number(p_payload->>'control_total','Control total',true) WHERE id=h.id; END IF;
IF p_payload ? 'source_note' THEN UPDATE public.project_boq SET source_note=p_payload->>'source_note' WHERE id=h.id; END IF;
ELSIF p_action<>'finalise' THEN RAISE EXCEPTION 'Unknown BOQ action'; END IF;
SELECT coalesce(sum(total_amount),0),count(*) INTO total,n FROM public.project_boq_items WHERE boq_id=h.id AND NOT is_archived;
IF p_action IN ('finalise','revise') THEN SELECT * INTO h FROM public.project_boq WHERE id=h.id; IF n=0 OR h.control_total<>total THEN RAISE EXCEPTION 'BOQ must contain at least one line and match the control total exactly in paise. Difference: %',h.control_total-total USING ERRCODE='22023'; END IF;
IF EXISTS(SELECT 1 FROM public.project_boq_items WHERE boq_id=h.id AND NOT is_archived AND (sno<=0 OR btrim(item_description)='' OR nullif(btrim(unit),'') IS NULL OR boq_qty<0 OR boq_rate<0)) THEN RAISE EXCEPTION 'Resolve line errors before finalising'; END IF; END IF;
UPDATE public.project_boq SET total_boq_value=total,tender_total_value=total,factory_scope_value=(SELECT coalesce(sum(total_amount),0) FROM public.project_boq_items WHERE boq_id=h.id AND NOT is_archived AND scope IN ('Factory','Both')),civil_scope_value=(SELECT coalesce(sum(total_amount),0) FROM public.project_boq_items WHERE boq_id=h.id AND NOT is_archived AND scope IN ('On-Site Civil','Both')),entry_version=entry_version+1,status=CASE WHEN p_action='finalise' THEN 'final' ELSE status END,final_at=CASE WHEN p_action='finalise' THEN now() ELSE final_at END,final_by=CASE WHEN p_action='finalise' THEN auth.uid() ELSE final_by END WHERE id=h.id;
RETURN public.boq1_get(p_project)||jsonb_build_object('save_results',coalesce(rows,'[]')); END $function$
 proname:boq1_mutate]
map[definition:CREATE OR REPLACE FUNCTION public.get_running_bill(p_project_id uuid, p_as_of date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_boq uuid; v jsonb;
BEGIN
  IF NOT public.can_view_running_bill(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to view the running bill' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_boq FROM public.project_boq WHERE project_id = p_project_id ORDER BY version_number DESC, uploaded_at DESC LIMIT 1;

  WITH rpt AS (
    SELECT id, measurement_date FROM public.daily_measurements
    WHERE project_id = p_project_id AND trade = 'daily_site_report' AND report_status = 'submitted'
      AND COALESCE(is_archived, false) = false AND measurement_date <= p_as_of
  ),
  q AS (SELECT s.boq_item_id,s.contractor_id,s.today_qty,s.rate_used,s.amount_inr,s.rate_id,s.extra_work_description,s.unit,'Site'::text source FROM public.site_report_quantities s JOIN rpt ON rpt.id=s.report_id UNION ALL SELECT f.boq_item_id,f.contractor_id,f.today_qty,f.rate_used,f.amount_inr,f.rate_id,NULL::text,f.unit,'Factory'::text FROM public.factory_report_quantities f JOIN public.factory_daily_reports fr ON fr.id=f.report_id JOIN public.modules m ON m.id=f.module_id WHERE m.project_id=p_project_id AND fr.status='submitted' AND NOT fr.is_archived AND NOT f.is_archived AND fr.report_date<=p_as_of),
  qa AS (
    SELECT boq_item_id, sum(today_qty) qty, sum(today_qty) FILTER (WHERE contractor_id IS NULL) own_qty,
           sum(today_qty) FILTER (WHERE contractor_id IS NOT NULL) sub_qty, sum(today_qty) FILTER(WHERE source='Factory') factory_qty
    FROM q WHERE boq_item_id IS NOT NULL GROUP BY boq_item_id
  ),
  items AS (
    SELECT b.id, b.sno, b.item_description, b.unit, b.boq_qty, b.boq_rate FROM public.project_boq_items b
    WHERE b.boq_id = v_boq OR b.id IN (SELECT boq_item_id FROM qa)
  ),
  work AS (
    SELECT i.sno, i.item_description, i.unit, COALESCE(i.boq_qty,0) boq_qty, COALESCE(qa.qty,0) qty, COALESCE(qa.own_qty,0) own_qty,
      COALESCE(qa.sub_qty,0) sub_qty, COALESCE(qa.factory_qty,0) factory_qty, CASE WHEN COALESCE(i.boq_qty,0) > 0 THEN round(COALESCE(qa.qty,0) / i.boq_qty * 100, 1) END pct_done,
      COALESCE(i.boq_rate,0) boq_rate,
      CASE WHEN COALESCE(i.boq_qty,0)>0 THEN least(COALESCE(qa.qty,0),i.boq_qty) ELSE COALESCE(qa.qty,0) END billable_qty,
      CASE WHEN COALESCE(i.boq_qty,0)>0 THEN greatest(COALESCE(qa.qty,0)-i.boq_qty,0) ELSE 0 END excess_qty,
      round((CASE WHEN COALESCE(i.boq_qty,0)>0 THEN greatest(COALESCE(qa.qty,0)-i.boq_qty,0) ELSE 0 END)*COALESCE(i.boq_rate,0),2) excess_value,
      round((CASE WHEN COALESCE(i.boq_qty,0)>0 THEN least(COALESCE(qa.qty,0),i.boq_qty) ELSE COALESCE(qa.qty,0) END)*COALESCE(i.boq_rate,0),2) value
    FROM items i LEFT JOIN qa ON qa.boq_item_id = i.id
  ),
  att AS (
    SELECT a.work_date, a.worker_id, a.hours, w.contractor_id,
      round(a.hours * COALESCE(comp.hourly_rate, comp.monthly_salary / 208, 0), 2) amount
    FROM public.labour_attendance a
    JOIN public.labour_workers w ON w.id = a.worker_id
    LEFT JOIN public.labour_worker_compensation comp ON comp.worker_id = a.worker_id
    WHERE a.project_id = p_project_id AND a.hours > 0 AND a.work_date IN (SELECT measurement_date FROM rpt)
  ),
  bday AS (SELECT work_date, count(DISTINCT worker_id) workers, sum(hours) hours, sum(amount) amount FROM att GROUP BY work_date),
  bcon AS (
    SELECT COALESCE(c.company_name, 'Direct') contractor, count(DISTINCT att.worker_id) workers, sum(att.hours) hours, sum(att.amount) amount
    FROM att LEFT JOIN public.labour_contractors c ON c.id = att.contractor_id GROUP BY 1
  ),
  exact_days AS(SELECT DISTINCT rpt.measurement_date d FROM rpt JOIN public.site_report_task_workers tw ON tw.report_id=rpt.id),
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
  sub AS (
    SELECT q.source location,c.company_name contractor, COALESCE(b.sno::text, '') boq_code,
      COALESCE(b.item_description, q.extra_work_description, r.work_description) item,
      COALESCE(r.unit, q.unit, b.unit) unit, r.rate_type, sum(q.today_qty) qty,
      CASE WHEN count(DISTINCT q.rate_used) = 1 THEN max(q.rate_used) ELSE round(sum(q.amount_inr) / NULLIF(sum(q.today_qty), 0), 4) END rate_used,
      sum(COALESCE(q.amount_inr, 0)) amount, r.lump_sum_inr lump_sum, r.package_qty,
      CASE WHEN r.rate_type = 'lump_sum' AND r.lump_sum_inr > 0 THEN round(sum(COALESCE(q.amount_inr,0)) / r.lump_sum_inr * 100, 1) END pct_consumed
    FROM q JOIN public.labour_contractors c ON c.id = q.contractor_id
    LEFT JOIN public.subcontract_rates r ON r.id = q.rate_id
    LEFT JOIN public.project_boq_items b ON b.id = q.boq_item_id
    WHERE q.contractor_id IS NOT NULL AND q.today_qty > 0
    GROUP BY q.source,c.company_name, b.sno, b.item_description, q.extra_work_description, r.work_description, r.unit, q.unit, b.unit, r.rate_type, r.lump_sum_inr, r.package_qty, r.id
  )
  SELECT jsonb_build_object(
    'as_of', p_as_of,
    'reports', (SELECT count(*) FROM rpt),
    'work', COALESCE((SELECT jsonb_agg(to_jsonb(work) ORDER BY work.sno) FROM work), '[]'),
    'labour_by_day', COALESCE((SELECT jsonb_agg(jsonb_build_object('work_date', work_date, 'workers', workers, 'hours', hours, 'amount', amount,
        'cumulative', cum) ORDER BY work_date) FROM (SELECT *, sum(amount) OVER (ORDER BY work_date) cum FROM bday) x), '[]'),
    'labour_by_contractor', COALESCE((SELECT jsonb_agg(to_jsonb(bcon) ORDER BY contractor) FROM bcon), '[]'),
    'labour_by_task', COALESCE((SELECT jsonb_agg(to_jsonb(btask) ORDER BY (task = 'Unallocated'), code) FROM btask), '[]'),
    'factory_labour', COALESCE((SELECT jsonb_agg(to_jsonb(z)) FROM(SELECT m.id module_id,m.module_code,m.name,sum(tw.hours) hours,sum(tw.hours*a.effective_hourly_rate) amount FROM public.factory_report_task_workers tw JOIN public.factory_daily_reports fr ON fr.id=tw.report_id JOIN public.modules m ON m.id=tw.module_id JOIN public.factory_labour_attendance a ON a.worker_id=tw.worker_id AND a.work_date=fr.report_date WHERE m.project_id=p_project_id AND fr.status='submitted' AND NOT fr.is_archived AND NOT tw.is_archived AND fr.report_date<=p_as_of GROUP BY m.id,m.module_code,m.name) z),'[]'::jsonb), 'subcontract', COALESCE((SELECT jsonb_agg(to_jsonb(sub) ORDER BY contractor, boq_code, item) FROM sub), '[]'),
    'totals', jsonb_build_object(
      'value_earned', COALESCE((SELECT sum(value) FROM work), 0),
      'excess_value', COALESCE((SELECT sum(excess_value) FROM work), 0),
      'factory_labour_cost',COALESCE((SELECT sum(tw.hours*a.effective_hourly_rate) FROM public.factory_report_task_workers tw JOIN public.factory_daily_reports fr ON fr.id=tw.report_id JOIN public.modules m ON m.id=tw.module_id JOIN public.factory_labour_attendance a ON a.worker_id=tw.worker_id AND a.work_date=fr.report_date WHERE m.project_id=p_project_id AND fr.status='submitted' AND NOT fr.is_archived AND NOT tw.is_archived AND fr.report_date<=p_as_of),0), 'own_labour_cost', COALESCE((SELECT sum(amount) FROM att), 0),
      'subcontract_accrued', COALESCE((SELECT sum(amount) FROM sub), 0))
  ) INTO v;
  RETURN v;
END $function$
 proname:get_running_bill]
map[definition:CREATE OR REPLACE FUNCTION public.recalc_running_bill(_project_id uuid)
 RETURNS TABLE(boq_item_id uuid, description text, unit text, stage text, trade text, boq_qty numeric, boq_rate numeric, boq_value numeric, qty_done_factory numeric, qty_done_site numeric, total_qty_done numeric, pct_complete numeric, value_earned numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    b.id AS boq_item_id,
    b.description,
    b.unit,
    b.stage,
    b.trade,
    b.boq_qty,
    b.boq_rate,
    (b.boq_qty * b.boq_rate)::numeric AS boq_value,
    COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.location = 'factory' AND dm.is_archived = false), 0)::numeric AS qty_done_factory,
    COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.location = 'site' AND dm.is_archived = false), 0)::numeric AS qty_done_site,
    COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.is_archived = false), 0)::numeric AS total_qty_done,
    CASE WHEN b.boq_qty > 0
      THEN LEAST(100, ROUND((COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.is_archived = false), 0) / b.boq_qty) * 100, 2))
      ELSE 0
    END::numeric AS pct_complete,
    (COALESCE(SUM(mli.today_qty) FILTER (WHERE dm.is_archived = false), 0) * b.boq_rate)::numeric AS value_earned
  FROM public.boq_items b
  LEFT JOIN public.measurement_line_items mli ON mli.boq_item_id = b.id
  LEFT JOIN public.daily_measurements dm ON dm.id = mli.measurement_id
  WHERE b.project_id = _project_id AND b.is_archived = false
  GROUP BY b.id, b.description, b.unit, b.stage, b.trade, b.boq_qty, b.boq_rate
  ORDER BY b.stage, b.description;
$function$
 proname:recalc_running_bill]]
```
