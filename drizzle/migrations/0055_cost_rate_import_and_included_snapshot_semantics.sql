DO $patch$ DECLARE d text; a text; BEGIN
 d:=pg_get_functiondef('public._snapshot_report_material(uuid,boolean)'::regprocedure); a:='material_rate_used=CASE WHEN c.included THEN 0 ELSE c.material_rate_inr END';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'Material capture anchor missing'; END IF;
 EXECUTE replace(d,a,'material_rate_used=c.material_rate_inr');
 d:=pg_get_functiondef('public.apply_cost_rates_upload(uuid,uuid,jsonb)'::regprocedure); a:='(e->>''includes_material'')::boolean,true)';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'Import active-state anchor missing'; END IF;
 EXECUTE replace(d,a,'(e->>''includes_material'')::boolean,coalesce((SELECT is_active FROM public.subcontract_rates WHERE project_id=p_project_id AND boq_item_id=(e->>''boq_item_id'')::uuid AND contractor_id=(e->>''contractor_id'')::uuid),true))');
END $patch$;