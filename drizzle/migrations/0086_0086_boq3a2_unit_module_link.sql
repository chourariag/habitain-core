ALTER TABLE public.project_schedule_units
  ADD COLUMN module_id uuid REFERENCES public.modules(id);

CREATE UNIQUE INDEX project_schedule_units_project_module_unique
  ON public.project_schedule_units(project_id, module_id)
  WHERE module_id IS NOT NULL;

DO $$
DECLARE
  u record;
  v_module uuid;
  v_matches integer;
BEGIN
  FOR u IN
    SELECT id, project_id, unit_label
    FROM public.project_schedule_units
    WHERE unit_kind = 'module' AND module_id IS NULL
    ORDER BY id
  LOOP
    SELECT count(*) INTO v_matches
    FROM public.modules m
    WHERE m.project_id = u.project_id
      AND NOT m.is_archived
      AND (lower(btrim(m.name)) = lower(btrim(u.unit_label))
           OR lower(btrim(m.module_code)) = lower(btrim(u.unit_label)));

    IF v_matches = 1 THEN
      SELECT m.id INTO v_module
      FROM public.modules m
      WHERE m.project_id = u.project_id
        AND NOT m.is_archived
        AND (lower(btrim(m.name)) = lower(btrim(u.unit_label))
             OR lower(btrim(m.module_code)) = lower(btrim(u.unit_label)))
      LIMIT 1;

      IF NOT EXISTS (
        SELECT 1 FROM public.project_schedule_units linked
        WHERE linked.project_id = u.project_id
          AND linked.module_id = v_module
          AND linked.id <> u.id
      ) THEN
        UPDATE public.project_schedule_units
        SET module_id = v_module
        WHERE id = u.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Table-wide INSERT/UPDATE grants already exist, so column-level REVOKEs would
-- not protect this column. Only the checked functions set the transaction flag.
CREATE OR REPLACE FUNCTION public.schedule_unit_module_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('hstack.schedule_unit_module_link', true) IS DISTINCT FROM 'on'
     AND ((TG_OP = 'INSERT' AND NEW.module_id IS NOT NULL)
          OR (TG_OP = 'UPDATE' AND NEW.module_id IS DISTINCT FROM OLD.module_id)) THEN
    RAISE EXCEPTION 'Factory module links must be changed with schedule_set_unit_module.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER project_schedule_units_module_guard
BEFORE INSERT OR UPDATE ON public.project_schedule_units
FOR EACH ROW EXECUTE FUNCTION public.schedule_unit_module_guard();

CREATE OR REPLACE FUNCTION public.schedule_set_unit_module(p_unit uuid, p_module uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  u public.project_schedule_units%ROWTYPE;
  m public.modules%ROWTYPE;
  v_other text;
BEGIN
  SELECT * INTO u FROM public.project_schedule_units WHERE id = p_unit;
  IF u.id IS NULL THEN
    RAISE EXCEPTION 'Schedule unit not found.' USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() IS NULL
     OR NOT public.can_edit_schedule(auth.uid())
     OR NOT public.user_can_access_project(auth.uid(), u.project_id) THEN
    RAISE EXCEPTION 'You do not have permission to link factory modules for this project.'
      USING ERRCODE = '42501';
  END IF;

  IF u.unit_kind <> 'module' THEN
    RAISE EXCEPTION 'Only module schedule units can be linked to a factory module.'
      USING ERRCODE = '22023';
  END IF;

  IF p_module IS NOT NULL THEN
    SELECT * INTO m FROM public.modules WHERE id = p_module;
    IF m.id IS NULL OR m.project_id <> u.project_id THEN
      RAISE EXCEPTION 'Factory module must belong to the same project as the schedule unit.'
        USING ERRCODE = '22023';
    END IF;
    IF m.is_archived THEN
      RAISE EXCEPTION 'Factory module is archived.' USING ERRCODE = '22023';
    END IF;

    SELECT unit_label INTO v_other
    FROM public.project_schedule_units
    WHERE project_id = u.project_id
      AND module_id = p_module
      AND id <> u.id
    LIMIT 1;
    IF v_other IS NOT NULL THEN
      RAISE EXCEPTION 'Module % is already linked to unit %', m.name, v_other
        USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('hstack.schedule_unit_module_link', 'on', true);
  UPDATE public.project_schedule_units
  SET module_id = p_module,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = u.id;

  RETURN jsonb_build_object(
    'unit_id', u.id,
    'module_id', p_module,
    'module_name', CASE WHEN p_module IS NULL THEN NULL ELSE m.name END
  );
END $$;

REVOKE ALL ON FUNCTION public.schedule_set_unit_module(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_set_unit_module(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.schedule_auto_match_units(p_project uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  u record;
  v_module uuid;
  v_matches integer;
  v_other text;
  v_linked integer := 0;
  v_skipped jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.can_edit_schedule(auth.uid())
     OR NOT public.user_can_access_project(auth.uid(), p_project) THEN
    RAISE EXCEPTION 'You do not have permission to link factory modules for this project.'
      USING ERRCODE = '42501';
  END IF;

  FOR u IN
    SELECT id, unit_label, module_id
    FROM public.project_schedule_units
    WHERE project_id = p_project AND unit_kind = 'module'
    ORDER BY unit_label, id
  LOOP
    IF u.module_id IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_array(
        jsonb_build_object('unit_label', u.unit_label, 'reason', 'Already linked'));
      CONTINUE;
    END IF;

    SELECT count(*) INTO v_matches
    FROM public.modules m
    WHERE m.project_id = p_project
      AND NOT m.is_archived
      AND (lower(btrim(m.name)) = lower(btrim(u.unit_label))
           OR lower(btrim(m.module_code)) = lower(btrim(u.unit_label)));

    IF v_matches = 0 THEN
      v_skipped := v_skipped || jsonb_build_array(
        jsonb_build_object('unit_label', u.unit_label, 'reason', 'No exact module name or code match'));
      CONTINUE;
    ELSIF v_matches > 1 THEN
      v_skipped := v_skipped || jsonb_build_array(
        jsonb_build_object('unit_label', u.unit_label, 'reason', 'More than one module matches'));
      CONTINUE;
    END IF;

    SELECT m.id INTO v_module
    FROM public.modules m
    WHERE m.project_id = p_project
      AND NOT m.is_archived
      AND (lower(btrim(m.name)) = lower(btrim(u.unit_label))
           OR lower(btrim(m.module_code)) = lower(btrim(u.unit_label)))
    LIMIT 1;

    SELECT unit_label INTO v_other
    FROM public.project_schedule_units
    WHERE project_id = p_project
      AND module_id = v_module
      AND id <> u.id
    LIMIT 1;
    IF v_other IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_array(
        jsonb_build_object('unit_label', u.unit_label,
                           'reason', format('Matching module is already linked to unit %s', v_other)));
      CONTINUE;
    END IF;

    PERFORM public.schedule_set_unit_module(u.id, v_module);
    v_linked := v_linked + 1;
  END LOOP;

  RETURN jsonb_build_object('linked', v_linked, 'skipped', v_skipped);
END $$;

REVOKE ALL ON FUNCTION public.schedule_auto_match_units(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_auto_match_units(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.boq3_task_report(p_project uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE s public.boq_link_sets; st jsonb; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.boq2_can_read(p_project) THEN
  RAISE EXCEPTION 'You do not have access to this project''s BOQ links.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.boq_link_sets WHERE project_id=p_project AND NOT is_archived;
 IF s.id IS NULL OR s.status<>'locked' THEN RETURN jsonb_build_object('status','no_locked_links'); END IF;
 st := public._boq2_state(p_project);
 WITH lk AS (
  SELECT (l->>'id')::uuid boq_item_id,(l->>'sno')::int sno,l->>'description' description,l->>'unit' uom,
   (k->>'id')::uuid link_id,k->>'unit_kind' unit_kind,k->>'unit_label' unit_label,(k->>'task_id')::uuid task_id,k->>'code' code,k->>'task_name' task_name,
   (k->>'share_pct')::numeric share_pct,(k->>'budget')::numeric budget,k->>'problem' problem,
   coalesce((SELECT (a->>'quantity')::numeric FROM jsonb_array_elements(l->'allocations') a WHERE a->>'unit_kind'=k->>'unit_kind' AND a->>'unit_label'=k->>'unit_label' LIMIT 1),0) alloc_qty,
   lower(btrim(coalesce(i.work_location,''))) loc
  FROM jsonb_array_elements(st->'lines') l CROSS JOIN LATERAL jsonb_array_elements(l->'links') k
  JOIN public.project_boq_items i ON i.id=(l->>'id')::uuid),
 units AS (SELECT DISTINCT unit_kind,unit_label FROM lk WHERE loc='factory'),
 unit_link AS (
  SELECT u.unit_kind,u.unit_label,su.module_id linked_module_id,linked.id linked_id,linked.is_archived linked_archived
  FROM units u
  LEFT JOIN public.project_schedule_units su ON su.project_id=p_project AND su.unit_kind=u.unit_kind AND su.unit_label=u.unit_label
  LEFT JOIN public.modules linked ON linked.id=su.module_id AND linked.project_id=p_project),
 umap AS (SELECT ul.unit_kind,ul.unit_label,ul.linked_module_id,ul.linked_id,ul.linked_archived,m.ids,
   (SELECT coalesce(jsonb_agg(mo.name ORDER BY mo.name),'[]') FROM public.modules mo WHERE mo.project_id=p_project AND NOT mo.is_archived) all_names
  FROM unit_link ul LEFT JOIN LATERAL (SELECT array_agg(mo.id) ids FROM public.modules mo WHERE ul.linked_module_id IS NULL AND mo.project_id=p_project AND NOT mo.is_archived AND ul.unit_kind='module'
    AND (lower(btrim(coalesce(mo.name,'')))=lower(btrim(ul.unit_label)) OR lower(btrim(coalesce(mo.module_code,'')))=lower(btrim(ul.unit_label)))) m ON true),
 um AS (SELECT unit_kind,unit_label,
   CASE WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND NOT linked_archived THEN linked_module_id
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=1 THEN ids[1] END module_id,
   CASE WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND NOT linked_archived THEN 'link'
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=1 THEN 'name' END mapped_by,
   CASE WHEN unit_kind<>'module' THEN 'Not a module unit'
        WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND linked_archived THEN 'Linked module is archived'
        WHEN linked_module_id IS NOT NULL AND linked_id IS NULL THEN 'Linked module is not available'
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=0 THEN 'No module matches this unit label'
        WHEN linked_module_id IS NULL AND cardinality(ids)>1 THEN 'More than one module matches this unit label' END unmapped_reason,
   all_names FROM umap),
 cons AS (SELECT q.boq_item_id,q.module_id,sum(coalesce(q.today_qty,0)) c,sum(coalesce(q.amount_inr,0)) amt
  FROM public.factory_report_quantities q JOIN public.factory_daily_reports r ON r.id=q.report_id
  JOIN public.modules mo ON mo.id=q.module_id AND mo.project_id=p_project
  WHERE NOT q.is_archived AND NOT r.is_archived AND r.status='submitted' GROUP BY 1,2),
 calc AS (SELECT lk.*,um.module_id,um.unmapped_reason,coalesce(c.c,0) consumed,coalesce(c.amt,0) amt,
   CASE WHEN lk.problem IS NOT NULL OR um.module_id IS NULL OR lk.alloc_qty=0 THEN 0 ELSE round(lk.budget*coalesce(c.c,0)/lk.alloc_qty,2) END earned,
   CASE WHEN lk.problem IS NOT NULL OR um.module_id IS NULL THEN 0 ELSE round(coalesce(c.amt,0)*lk.share_pct/100,2) END actual,
   greatest(coalesce(c.c,0)-lk.alloc_qty,0) overrun_qty
  FROM lk JOIN um USING (unit_kind,unit_label)
  LEFT JOIN cons c ON c.boq_item_id=lk.boq_item_id AND c.module_id=um.module_id WHERE lk.loc='factory'),
 tasks AS (SELECT unit_kind,unit_label,task_id,max(code) code,max(task_name) task_name,sum(budget) budget,sum(earned) earned,sum(actual) actual,
   bool_or(overrun_qty>0) overrun,bool_or(problem IS NOT NULL) broken,count(*) links FROM calc GROUP BY 1,2,3),
 site AS (SELECT boq_item_id,min(sno) sno,max(description) description,max(uom) uom,sum(budget) budget FROM lk WHERE loc<>'factory' GROUP BY 1)
 SELECT jsonb_build_object(
  'status','ok','link_set_version',s.version,
  'links',coalesce((SELECT jsonb_agg(jsonb_build_object('link_id',link_id,'boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'unit_kind',unit_kind,'unit_label',unit_label,
     'task_id',task_id,'code',code,'task_name',task_name,'share_pct',share_pct,'budget',budget,'allocated_qty',alloc_qty,'consumed_qty',consumed,'earned',earned,'actual',actual,
     'variance',earned-actual,'overrun_qty',overrun_qty,'mapped',module_id IS NOT NULL,'problem',problem) ORDER BY unit_kind,unit_label,code,sno) FROM calc),'[]'),
  'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'task_id',task_id,'code',code,'task_name',task_name,'budget',budget,'earned',earned,
     'actual',actual,'variance',earned-actual,'overrun',overrun,'broken',broken,'links',links) ORDER BY unit_kind,unit_label,code) FROM tasks),'[]'),
  'units',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',u.unit_kind,'unit_label',u.unit_label,'mapped',u.module_id IS NOT NULL,'mapped_by',u.mapped_by,
     'module_name',(SELECT name FROM public.modules WHERE id=u.module_id),'unmapped_reason',u.unmapped_reason,
     'modules_found',CASE WHEN u.module_id IS NULL THEN u.all_names ELSE '[]'::jsonb END,
     'budget',t.budget,'earned',t.earned,'actual',t.actual,'variance',t.earned-t.actual,'overrun',t.overrun) ORDER BY u.unit_kind,u.unit_label)
   FROM um u JOIN (SELECT unit_kind,unit_label,sum(budget) budget,sum(earned) earned,sum(actual) actual,bool_or(overrun) overrun FROM tasks GROUP BY 1,2) t USING (unit_kind,unit_label)),'[]'),
  'site_lines',coalesce((SELECT jsonb_agg(jsonb_build_object('boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'budget',budget,
     'note','Waiting for unit on site reports') ORDER BY sno) FROM site),'[]'),
  'totals',jsonb_build_object('factory_budget',coalesce((SELECT sum(budget) FROM calc),0),'earned',coalesce((SELECT sum(earned) FROM calc),0),
     'actual',coalesce((SELECT sum(actual) FROM calc),0),'variance',coalesce((SELECT sum(earned-actual) FROM calc),0),
     'site_budget',coalesce((SELECT sum(budget) FROM site),0),'unmapped_units',(SELECT count(*) FROM um WHERE module_id IS NULL),
     'overrun_links',(SELECT count(*) FROM calc WHERE overrun_qty>0),'broken_links',(SELECT count(*) FROM calc WHERE problem IS NOT NULL)))
 INTO result;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.boq3_task_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boq3_task_report(uuid) TO authenticated;