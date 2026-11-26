CREATE OR REPLACE FUNCTION public.boq1_can_write(p_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT public.boq1_can_read(p_project) AND EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=auth.uid() AND is_active AND NOT is_archived) AND public.user_has_any_role(auth.uid(),ARRAY['super_admin','managing_director','finance_director','finance_manager','planning_engineer','architecture_director','project_architect','principal_architect','sales_director','planning_head','costing_engineer','quantity_surveyor','head_operations']::public.app_role[]); $$;
CREATE OR REPLACE FUNCTION public._boq1b_consumption(p_line uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE b public.project_boq_items%ROWTYPE; pid uuid; factory numeric:=0; site numeric:=0; mismatched integer:=0; frozen integer:=0; frozen_amount numeric:=0; frozen_sources text; earned numeric:=0; BEGIN
SELECT i.* INTO b FROM public.project_boq_items i WHERE i.id=p_line; SELECT project_id INTO pid FROM public.project_boq WHERE id=b.boq_id;
IF b.id IS NULL THEN RAISE EXCEPTION 'BOQ line not found' USING ERRCODE='22023'; END IF;
WITH reported AS (
 SELECT 'factory reports'::text source,q.unit,q.today_qty FROM public.factory_report_quantities q JOIN public.factory_daily_reports r ON r.id=q.report_id JOIN public.modules m ON m.id=q.module_id WHERE q.boq_item_id=b.id AND m.project_id=pid AND r.status='submitted' AND NOT r.is_archived AND NOT q.is_archived AND q.today_qty>0
 UNION ALL SELECT 'site reports',coalesce(nullif(btrim(q.unit),''),b.unit),q.today_qty FROM public.site_report_quantities q JOIN public.daily_measurements r ON r.id=q.report_id WHERE q.boq_item_id=b.id AND q.project_id=pid AND r.project_id=pid AND r.trade='daily_site_report' AND r.report_status='submitted' AND NOT coalesce(r.is_archived,false) AND q.today_qty>0
) SELECT coalesce(sum(today_qty) FILTER(WHERE source='factory reports' AND public._boq1_normal(unit)=public._boq1_normal(b.unit)),0),coalesce(sum(today_qty) FILTER(WHERE source='site reports' AND public._boq1_normal(unit)=public._boq1_normal(b.unit)),0),count(*) FILTER(WHERE public._boq1_normal(unit)<>public._boq1_normal(b.unit)) INTO factory,site,mismatched FROM reported;
-- Frozen snapshots remain historical evidence even when a submitted report/row was later archived or reopened.
WITH snapshots AS (
 SELECT 'factory report frozen rates/amounts'::text source,coalesce(q.amount_inr,0)+coalesce(q.material_amount_inr,0) amount FROM public.factory_report_quantities q JOIN public.factory_daily_reports r ON r.id=q.report_id JOIN public.modules m ON m.id=q.module_id WHERE q.boq_item_id=b.id AND m.project_id=pid AND (q.rate_used IS NOT NULL OR q.material_rate_used IS NOT NULL OR coalesce(q.amount_inr,0)<>0 OR coalesce(q.material_amount_inr,0)<>0) AND (r.status='submitted' OR r.submitted_at IS NOT NULL OR q.material_rate_missing IS NOT NULL)
 UNION ALL SELECT 'site report frozen rates/amounts',coalesce(q.amount_inr,0)+coalesce(q.material_amount_inr,0) FROM public.site_report_quantities q JOIN public.daily_measurements r ON r.id=q.report_id WHERE q.boq_item_id=b.id AND q.project_id=pid AND r.project_id=pid AND r.trade='daily_site_report' AND (q.rate_used IS NOT NULL OR q.material_rate_used IS NOT NULL OR coalesce(q.amount_inr,0)<>0 OR coalesce(q.material_amount_inr,0)<>0) AND (r.report_status='submitted' OR r.submitted_at IS NOT NULL OR q.material_rate_missing IS NOT NULL)
) SELECT count(*),coalesce(sum(amount),0),string_agg(DISTINCT source,', ' ORDER BY source) INTO frozen,frozen_amount,frozen_sources FROM snapshots;
-- Running Bill is a derived view of these same reports, not additional consumed units.
earned:=round((CASE WHEN b.boq_qty>0 THEN least(factory+site,b.boq_qty) ELSE factory+site END)*b.boq_rate,2);
RETURN jsonb_build_object('factory_qty',factory,'site_qty',site,'total_qty',factory+site,'unit',b.unit,'mismatched_rows',mismatched,'frozen_count',frozen,'frozen_amount',frozen_amount,'frozen_sources',coalesce(frozen_sources,''),'running_bill_value',earned);
END $$;
CREATE OR REPLACE FUNCTION public._boq1b_check_change(p_old public.project_boq_items,p_patch jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE c jsonb; qty numeric; new_qty numeric; new_rate numeric; changing_unit boolean; removing boolean; source text; line text; frozen_count int; mismatches int; BEGIN
c:=public._boq1b_consumption(p_old.id); qty:=(c->>'total_qty')::numeric; frozen_count:=(c->>'frozen_count')::int; mismatches:=(c->>'mismatched_rows')::int;
removing:=coalesce((p_patch->>'remove')::boolean,false) OR (coalesce((p_patch->>'is_archived')::boolean,false) AND NOT p_old.is_archived);
new_qty:=CASE WHEN p_patch ? 'boq_qty' THEN public._boq1_number(p_patch->>'boq_qty','Quantity') ELSE p_old.boq_qty END;
new_rate:=CASE WHEN p_patch ? 'boq_rate' THEN public._boq1_number(p_patch->>'boq_rate','Rate') ELSE p_old.boq_rate END;
changing_unit:=p_patch ? 'unit' AND public._boq1_normal(p_patch->>'unit') IS DISTINCT FROM public._boq1_normal(p_old.unit);
line:=format('Item %s — %s',p_old.sno,p_old.item_description);
source:=format('%s %s consumed: factory reports %s; site reports %s. Running bill uses the same quantities (not counted twice), value ₹%s',qty,p_old.unit,c->>'factory_qty',c->>'site_qty',to_char((c->>'running_bill_value')::numeric,'FM999999999999999999990.00'));
IF frozen_count>0 THEN source:=source||format('. %s: %s frozen records, amount ₹%s',c->>'frozen_sources',frozen_count,to_char((c->>'frozen_amount')::numeric,'FM999999999999999999990.00')); END IF;
IF mismatches>0 AND (removing OR changing_unit OR new_qty<p_old.boq_qty OR new_rate IS DISTINCT FROM p_old.boq_rate) THEN RAISE EXCEPTION '% cannot be changed this way: % submitted factory/site report rows have a different unit. Resolve their unit mismatch first. %',line,mismatches,source USING ERRCODE='42501'; END IF;
IF removing AND (qty>0 OR frozen_count>0) THEN RAISE EXCEPTION '% cannot be removed. %',line,source USING ERRCODE='42501'; END IF;
IF new_qty<p_old.boq_qty AND new_qty<qty THEN RAISE EXCEPTION '% cannot have quantity % % below its consumed quantity. %',line,new_qty,p_old.unit,source USING ERRCODE='42501'; END IF;
IF changing_unit AND qty>0 THEN RAISE EXCEPTION '% cannot change unit while reported quantity exists. %',line,source USING ERRCODE='42501'; END IF;
IF new_rate IS DISTINCT FROM p_old.boq_rate AND (qty>0 OR frozen_count>0) THEN RAISE EXCEPTION '% cannot change its rate: past reported work or frozen rates cannot be repriced through a BOQ revision. %',line,source USING ERRCODE='42501'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public._boq1b_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
IF OLD.entry_managed AND EXISTS(SELECT 1 FROM public.project_boq WHERE id=OLD.boq_id AND entry_mode='fresh') AND (NEW.is_archived IS DISTINCT FROM OLD.is_archived OR NEW.boq_qty IS DISTINCT FROM OLD.boq_qty OR NEW.boq_rate IS DISTINCT FROM OLD.boq_rate OR NEW.unit IS DISTINCT FROM OLD.unit) THEN PERFORM public._boq1b_check_change(OLD,jsonb_build_object('is_archived',NEW.is_archived,'boq_qty',NEW.boq_qty::text,'boq_rate',NEW.boq_rate::text,'unit',NEW.unit)); END IF; RETURN NEW; END $$;
CREATE TRIGGER aab_boq1b_consumed_line_guard BEFORE UPDATE ON public.project_boq_items FOR EACH ROW EXECUTE FUNCTION public._boq1b_line_guard();
DO $patch$ DECLARE definition text; anchor text; replacement text; BEGIN
SELECT pg_get_functiondef('public.boq1_mutate(uuid,text,jsonb,integer)'::regprocedure) INTO definition;
anchor:='PERFORM set_config(''hstack.boq_entry'',h.id::text,true);';
replacement:=$body$-- Preflight outside the per-row exception handler: refusals stay plain, atomic and 42501.
IF p_action IN ('save','revise') AND jsonb_typeof(coalesce(p_payload->'rows','[]'::jsonb))='array' THEN
  -- Read-only transaction locks prevent quantities or snapshots appearing between the check and save.
  LOCK TABLE public.daily_measurements,public.factory_daily_reports,public.factory_report_quantities,public.site_report_quantities IN SHARE MODE;
  PERFORM public._boq1b_check_change(i,r.value)
    FROM jsonb_array_elements(coalesce(p_payload->'rows','[]'::jsonb)) r
    JOIN public.project_boq_items i ON i.id::text=r.value->>'id'
    WHERE i.boq_id=h.id AND i.entry_managed AND NOT i.is_archived;
END IF;
PERFORM set_config('hstack.boq_entry',h.id::text,true);$body$;
IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'BOQ mutation preflight anchor missing'; END IF;
definition:=replace(definition,anchor,replacement); EXECUTE definition;
END $patch$;
REVOKE ALL ON FUNCTION public._boq1b_consumption(uuid),public._boq1b_check_change(public.project_boq_items,jsonb),public._boq1b_line_guard() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public._boq1b_consumption(uuid) IS 'Read-only, project-bound source quantities; Running Bill is derived and never double counted. Mutable configured rates/logs and separate legacy boq_items measurements are not frozen consumption.';
COMMENT ON FUNCTION public._boq1b_check_change(public.project_boq_items,jsonb) IS 'Protects fresh draft/final consumed lines, with item/source quantities and frozen values in 42501 messages. No downstream writes or rule changes.';