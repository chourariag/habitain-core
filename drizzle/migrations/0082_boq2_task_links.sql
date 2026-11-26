CREATE TABLE public.boq_link_sets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.projects(id), boq_id uuid REFERENCES public.project_boq(id), status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','locked')), version integer NOT NULL DEFAULT 0, locked_at timestamptz, locked_by uuid, rules_source text NOT NULL DEFAULT 'BOQ-2 v1: exact unit split per line; task shares total exactly 100.00 per unit; same-unit ordinary tasks only', created_by uuid NOT NULL, updated_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), is_archived boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX boq_link_sets_one_active ON public.boq_link_sets(project_id) WHERE NOT is_archived;
CREATE INDEX boq_link_sets_boq_idx ON public.boq_link_sets(boq_id);

CREATE TABLE public.boq_unit_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.projects(id), link_set_id uuid NOT NULL REFERENCES public.boq_link_sets(id), boq_item_id uuid NOT NULL REFERENCES public.project_boq_items(id), unit_kind text NOT NULL, unit_label text NOT NULL, quantity numeric NOT NULL CHECK (quantity >= 0 AND quantity < 1e15), created_by uuid NOT NULL, updated_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), is_archived boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX boq_unit_alloc_one_active ON public.boq_unit_allocations(link_set_id,boq_item_id,unit_kind,unit_label) WHERE NOT is_archived;
CREATE INDEX boq_unit_alloc_project_idx ON public.boq_unit_allocations(project_id);
CREATE INDEX boq_unit_alloc_item_idx ON public.boq_unit_allocations(boq_item_id);

CREATE TABLE public.boq_task_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.projects(id), link_set_id uuid NOT NULL REFERENCES public.boq_link_sets(id), boq_item_id uuid NOT NULL REFERENCES public.project_boq_items(id), unit_kind text NOT NULL, unit_label text NOT NULL, task_id uuid NOT NULL REFERENCES public.project_tasks(id), share_pct numeric NOT NULL CHECK (share_pct > 0 AND share_pct <= 100 AND share_pct = round(share_pct,2)), created_by uuid NOT NULL, updated_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), is_archived boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX boq_task_links_one_active ON public.boq_task_links(link_set_id,boq_item_id,unit_kind,unit_label,task_id) WHERE NOT is_archived;
CREATE INDEX boq_task_links_project_idx ON public.boq_task_links(project_id);
CREATE INDEX boq_task_links_item_idx ON public.boq_task_links(boq_item_id);
CREATE INDEX boq_task_links_task_idx ON public.boq_task_links(task_id);

CREATE TABLE public.boq_link_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.projects(id), link_set_id uuid NOT NULL REFERENCES public.boq_link_sets(id), boq_item_id uuid, action text NOT NULL, reason text, old_value jsonb, new_value jsonb, created_by uuid NOT NULL, updated_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), is_archived boolean NOT NULL DEFAULT false);
CREATE INDEX boq_link_audit_project_idx ON public.boq_link_audit(project_id, created_at DESC);
CREATE INDEX boq_link_audit_set_idx ON public.boq_link_audit(link_set_id);

GRANT SELECT ON public.boq_link_sets, public.boq_unit_allocations, public.boq_task_links, public.boq_link_audit TO authenticated;
GRANT ALL ON public.boq_link_sets, public.boq_unit_allocations, public.boq_task_links, public.boq_link_audit TO service_role;

CREATE OR REPLACE FUNCTION public.boq2_can_write(p_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND public.user_can_access_project(auth.uid(),p_project)
  AND EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=auth.uid() AND is_active AND NOT is_archived)
  AND (public.boq1_can_write(p_project) OR public.can_edit_schedule(auth.uid())); $$;
CREATE OR REPLACE FUNCTION public.boq2_can_read(p_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.boq1_can_read(p_project) OR public.boq2_can_write(p_project); $$;

ALTER TABLE public.boq_link_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_unit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_link_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "BOQ readers view link sets" ON public.boq_link_sets FOR SELECT TO authenticated USING (public.boq2_can_read(project_id));
CREATE POLICY "BOQ readers view unit split" ON public.boq_unit_allocations FOR SELECT TO authenticated USING (public.boq2_can_read(project_id));
CREATE POLICY "BOQ readers view task links" ON public.boq_task_links FOR SELECT TO authenticated USING (public.boq2_can_read(project_id));
CREATE POLICY "BOQ readers view link history" ON public.boq_link_audit FOR SELECT TO authenticated USING (public.boq2_can_read(project_id));

CREATE OR REPLACE FUNCTION public._boq2_units(p_project uuid) RETURNS TABLE(unit_kind text, unit_label text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT u.unit_kind,u.unit_label FROM public.project_schedule_units u WHERE u.project_id=p_project AND u.unit_kind IS NOT NULL AND u.unit_label IS NOT NULL
 UNION SELECT t.unit_kind,t.unit_label FROM public.project_tasks t WHERE t.project_id=p_project AND NOT coalesce(t.is_removed,false) AND t.unit_kind IS NOT NULL AND t.unit_label IS NOT NULL; $$;

CREATE OR REPLACE FUNCTION public._boq2_task_problem(p_task uuid, p_project uuid, p_kind text, p_label text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN t.id IS NULL OR t.project_id<>p_project THEN 'task is not in this project'
  WHEN coalesce(t.is_removed,false) THEN 'task was removed from the schedule'
  WHEN coalesce(t.is_qc_gate,false) THEN 'QC gates cannot carry BOQ value'
  WHEN coalesce(t.is_payment_milestone,false) THEN 'payment milestones cannot carry BOQ value'
  WHEN t.task_type::text<>'task' THEN 'only ordinary tasks can carry BOQ value'
  WHEN t.unit_kind IS DISTINCT FROM p_kind OR t.unit_label IS DISTINCT FROM p_label THEN 'task is in '||coalesce(t.unit_kind||' '||t.unit_label,'no unit')||', not '||p_kind||' '||p_label
  END FROM (SELECT 1) x LEFT JOIN public.project_tasks t ON t.id=p_task; $$;

CREATE OR REPLACE FUNCTION public._boq2_line_label(p_item uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT 'Item '||sno||' ('||left(coalesce(item_description,''),60)||')' FROM public.project_boq_items WHERE id=p_item; $$;

CREATE OR REPLACE FUNCTION public._boq2_state(p_project uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h public.project_boq; s public.boq_link_sets; block text; result jsonb;
BEGIN
 SELECT * INTO h FROM public.project_boq WHERE project_id=p_project AND NOT is_archived ORDER BY version_number DESC,uploaded_at DESC,id DESC LIMIT 1;
 SELECT * INTO s FROM public.boq_link_sets WHERE project_id=p_project AND NOT is_archived;
 block:=CASE WHEN h.id IS NULL THEN 'This project has no BOQ yet.' WHEN h.entry_mode='fresh' AND h.status<>'final' THEN 'Finalise the fresh BOQ before linking it to tasks.' END;
 WITH lines AS (
  SELECT i.id,i.sno,i.item_description,i.unit,coalesce(i.boq_qty,0) qty,coalesce(i.boq_rate,0) rate,round(coalesce(i.boq_qty,0)*coalesce(i.boq_rate,0),2) value,i.schedule_task_id,ht.task_id_in_schedule hint_code,ht.task_name hint_name
  FROM public.project_boq_items i LEFT JOIN public.project_tasks ht ON ht.id=i.schedule_task_id WHERE i.boq_id=h.id AND NOT i.is_archived),
 units AS (SELECT * FROM public._boq2_units(p_project)),
 alloc AS (SELECT a.id,a.boq_item_id,a.unit_kind,a.unit_label,a.quantity,NOT EXISTS(SELECT 1 FROM units u WHERE u.unit_kind=a.unit_kind AND u.unit_label=a.unit_label) unit_missing
  FROM public.boq_unit_allocations a JOIN lines l ON l.id=a.boq_item_id WHERE a.link_set_id=s.id AND NOT a.is_archived),
 lk AS (SELECT k.id,k.boq_item_id,k.unit_kind,k.unit_label,k.task_id,k.share_pct,t.task_id_in_schedule code,t.task_name,
   coalesce(public._boq2_task_problem(k.task_id,p_project,k.unit_kind,k.unit_label),CASE WHEN a.id IS NULL OR a.quantity=0 THEN 'unit has no quantity for this line' END) problem,
   coalesce(a.quantity,0) uq,l.rate
  FROM public.boq_task_links k JOIN lines l ON l.id=k.boq_item_id LEFT JOIN public.project_tasks t ON t.id=k.task_id
  LEFT JOIN alloc a ON a.boq_item_id=k.boq_item_id AND a.unit_kind=k.unit_kind AND a.unit_label=k.unit_label
  WHERE k.link_set_id=s.id AND NOT k.is_archived),
 cum AS (SELECT lk.*,
   sum(CASE WHEN problem IS NULL THEN uq*rate*share_pct/100 ELSE 0 END) OVER (PARTITION BY boq_item_id ORDER BY unit_kind,unit_label,code NULLS LAST,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) running FROM lk),
 valued AS (SELECT cum.*,CASE WHEN problem IS NULL THEN round(running,2)-round(coalesce(lag(running) OVER (PARTITION BY boq_item_id ORDER BY unit_kind,unit_label,code NULLS LAST,id),0),2) ELSE 0 END budget FROM cum),
 unit_tot AS (SELECT boq_item_id,unit_kind,unit_label,coalesce(sum(share_pct) FILTER (WHERE problem IS NULL),0) share_total FROM lk GROUP BY 1,2,3),
 line_st AS (SELECT l.*,
   coalesce((SELECT sum(a.quantity) FROM alloc a WHERE a.boq_item_id=l.id),0) alloc_sum,
   (SELECT count(*) FROM alloc a WHERE a.boq_item_id=l.id) alloc_n,
   (SELECT count(*) FROM lk WHERE lk.boq_item_id=l.id) link_n,
   (SELECT count(*) FROM lk WHERE lk.boq_item_id=l.id AND lk.problem IS NOT NULL)+(SELECT count(*) FROM alloc a WHERE a.boq_item_id=l.id AND a.unit_missing AND a.quantity>0) broken_n,
   EXISTS(SELECT 1 FROM alloc a LEFT JOIN unit_tot u ON u.boq_item_id=a.boq_item_id AND u.unit_kind=a.unit_kind AND u.unit_label=a.unit_label WHERE a.boq_item_id=l.id AND a.quantity>0 AND coalesce(u.share_total,0)<>100) shares_short,
   coalesce((SELECT sum(v.budget) FROM valued v WHERE v.boq_item_id=l.id),0) linked
  FROM lines l),
 st AS (SELECT line_st.*,CASE WHEN qty=0 THEN 'skipped' WHEN broken_n>0 THEN 'broken' WHEN alloc_n=0 AND link_n=0 THEN 'not_started' WHEN alloc_sum<>qty THEN 'split_incomplete' WHEN shares_short THEN 'shares_incomplete' ELSE 'complete' END status FROM line_st),
 tot AS (SELECT coalesce(sum(value) FILTER (WHERE qty<>0),0) boq_total,coalesce(sum(linked),0) linked,count(*) FILTER (WHERE qty<>0) needed,count(*) FILTER (WHERE status='complete') complete,count(*) FILTER (WHERE status='broken') broken,count(*) FILTER (WHERE qty=0) skipped FROM st)
 SELECT jsonb_build_object(
  'boq',CASE WHEN h.id IS NULL THEN NULL ELSE jsonb_build_object('id',h.id,'entry_mode',h.entry_mode,'status',h.status,'version_number',h.version_number) END,
  'blocked_reason',block,
  'set',CASE WHEN s.id IS NULL THEN jsonb_build_object('status','draft','version',0) ELSE jsonb_build_object('id',s.id,'status',s.status,'version',s.version,'locked_at',s.locked_at,'locked_by',s.locked_by,'locked_by_name',(SELECT full_name FROM public.profiles WHERE auth_user_id=s.locked_by LIMIT 1),'rules_source',s.rules_source) END,
  'totals',(SELECT jsonb_build_object('boq_total',boq_total,'linked',linked,'unlinked',boq_total-linked,'lines_needed',needed,'lines_complete',complete,'lines_broken',broken,'lines_skipped',skipped) FROM tot),
  'coverage_reason',(SELECT CASE WHEN block IS NOT NULL THEN block WHEN needed=0 THEN 'There are no BOQ lines with quantity to link.' WHEN broken>0 THEN broken||' line(s) have broken links to fix.' WHEN complete<needed THEN (needed-complete)||' of '||needed||' line(s) are not fully split and shared.' WHEN linked<>boq_total THEN 'Linked value does not match the BOQ total.' END FROM tot),
  'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',st.id,'sno',st.sno,'description',st.item_description,'unit',st.unit,'qty',st.qty,'rate',st.rate,'value',st.value,'linked',st.linked,'allocated',st.alloc_sum,'status',st.status,
     'legacy_task_hint',CASE WHEN st.schedule_task_id IS NULL THEN NULL ELSE btrim(coalesce(st.hint_code,'')||' '||coalesce(st.hint_name,'')) END,
     'allocations',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',a.unit_kind,'unit_label',a.unit_label,'quantity',a.quantity,'unit_missing',a.unit_missing,'share_total',coalesce(u.share_total,0)) ORDER BY a.unit_kind,a.unit_label) FROM alloc a LEFT JOIN unit_tot u ON u.boq_item_id=a.boq_item_id AND u.unit_kind=a.unit_kind AND u.unit_label=a.unit_label WHERE a.boq_item_id=st.id),'[]'),
     'links',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'unit_kind',v.unit_kind,'unit_label',v.unit_label,'task_id',v.task_id,'code',v.code,'task_name',v.task_name,'share_pct',v.share_pct,'budget',v.budget,'problem',v.problem) ORDER BY v.unit_kind,v.unit_label,v.code) FROM valued v WHERE v.boq_item_id=st.id),'[]')) ORDER BY st.sno) FROM st),'[]'),
  'broken',coalesce((SELECT jsonb_agg(b.x ORDER BY b.x->>'sno') FROM (SELECT jsonb_build_object('sno',l.sno,'description',l.item_description,'unit_kind',lk.unit_kind,'unit_label',lk.unit_label,'code',lk.code,'reason',lk.problem) x FROM lk JOIN lines l ON l.id=lk.boq_item_id WHERE lk.problem IS NOT NULL
     UNION ALL SELECT jsonb_build_object('sno',l.sno,'description',l.item_description,'unit_kind',a.unit_kind,'unit_label',a.unit_label,'code',NULL,'reason','unit is no longer in the schedule') FROM alloc a JOIN lines l ON l.id=a.boq_item_id WHERE a.unit_missing AND a.quantity>0) b),'[]'),
  'task_budgets',coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',tb.task_id,'code',tb.code,'task_name',tb.task_name,'unit_kind',tb.unit_kind,'unit_label',tb.unit_label,'budget',tb.budget,'lines',tb.n) ORDER BY tb.unit_kind,tb.unit_label,tb.code) FROM (SELECT task_id,code,task_name,unit_kind,unit_label,sum(budget) budget,count(DISTINCT boq_item_id) n FROM valued WHERE problem IS NULL GROUP BY 1,2,3,4,5) tb),'[]'),
  'unit_budgets',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',ub.unit_kind,'unit_label',ub.unit_label,'budget',ub.budget) ORDER BY ub.unit_kind,ub.unit_label) FROM (SELECT unit_kind,unit_label,sum(budget) budget FROM valued WHERE problem IS NULL GROUP BY 1,2) ub),'[]'),
  'units',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',un.unit_kind,'unit_label',un.unit_label) ORDER BY un.unit_kind,un.unit_label) FROM units un),'[]'),
  'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'code',t.task_id_in_schedule,'task_name',t.task_name,'unit_kind',t.unit_kind,'unit_label',t.unit_label,'library_task_id',t.library_task_id) ORDER BY t.unit_kind,t.unit_label,t.task_id_in_schedule) FROM public.project_tasks t WHERE t.project_id=p_project AND NOT coalesce(t.is_removed,false) AND t.task_type::text='task' AND NOT coalesce(t.is_qc_gate,false) AND NOT coalesce(t.is_payment_milestone,false) AND t.unit_kind IS NOT NULL AND t.unit_label IS NOT NULL),'[]'),
  'audit',coalesce((SELECT jsonb_agg(jsonb_build_object('id',au.id,'action',au.action,'reason',au.reason,'boq_item_id',au.boq_item_id,'old_value',au.old_value,'new_value',au.new_value,'created_at',au.created_at,'actor',coalesce(pr.full_name,'Unknown')) ORDER BY au.created_at DESC) FROM (SELECT * FROM public.boq_link_audit WHERE project_id=p_project ORDER BY created_at DESC LIMIT 100) au LEFT JOIN public.profiles pr ON pr.auth_user_id=au.created_by),'[]'))
 INTO result FROM (SELECT 1) one;
 RETURN result || jsonb_build_object('can_lock',(result->'set'->>'status')='draft' AND result->>'coverage_reason' IS NULL,
  'lock_reason',CASE WHEN (result->'set'->>'status')='locked' THEN 'Links are already locked.' ELSE result->>'coverage_reason' END,
  'revision_needed',(result->'set'->>'status')='locked' AND result->>'coverage_reason' IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.boq2_get(p_project uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.boq2_can_read(p_project) THEN RAISE EXCEPTION 'You do not have access to this project''s BOQ links.' USING ERRCODE='42501'; END IF;
 RETURN public._boq2_state(p_project) || jsonb_build_object('can_write',public.boq2_can_write(p_project));
END $$;

CREATE OR REPLACE FUNCTION public._boq2_apply_split(p_set uuid,p_project uuid,p_boq uuid,p_item uuid,p_allocs jsonb,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l record; a jsonb; total numeric:=0; q numeric; old jsonb; neu jsonb; label text;
BEGIN
 SELECT id,coalesce(boq_qty,0) qty INTO l FROM public.project_boq_items WHERE id=p_item AND boq_id=p_boq AND NOT is_archived;
 IF NOT FOUND THEN RAISE EXCEPTION 'This line is not in the project''s current BOQ.' USING ERRCODE='42501'; END IF;
 label:=public._boq2_line_label(p_item);
 IF l.qty=0 THEN RAISE EXCEPTION USING MESSAGE=format('%s has zero quantity and is skipped; it needs no split.',label); END IF;
 IF jsonb_typeof(p_allocs) IS DISTINCT FROM 'array' OR jsonb_array_length(p_allocs)=0 THEN RAISE EXCEPTION USING MESSAGE=format('%s: choose at least one unit for the quantity split.',label); END IF;
 FOR a IN SELECT * FROM jsonb_array_elements(p_allocs) LOOP
  BEGIN q:=(a->>'quantity')::numeric; EXCEPTION WHEN others THEN RAISE EXCEPTION USING MESSAGE=format('%s: "%s" is not a valid quantity.',label,a->>'quantity'); END;
  IF q IS NULL OR q<0 OR q::text IN ('NaN','Infinity') THEN RAISE EXCEPTION USING MESSAGE=format('%s: unit quantities must be zero or more.',label); END IF;
  IF NOT EXISTS(SELECT 1 FROM public._boq2_units(p_project) u WHERE u.unit_kind=a->>'unit_kind' AND u.unit_label=a->>'unit_label') THEN RAISE EXCEPTION USING MESSAGE=format('%s: unit %s %s is not in this project''s schedule.',label,a->>'unit_kind',a->>'unit_label'); END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_allocs) e WHERE e->>'unit_kind'=a->>'unit_kind' AND e->>'unit_label'=a->>'unit_label')>1 THEN RAISE EXCEPTION USING MESSAGE=format('%s: unit %s %s is listed twice.',label,a->>'unit_kind',a->>'unit_label'); END IF;
  total:=total+q;
 END LOOP;
 IF total<>l.qty THEN RAISE EXCEPTION USING MESSAGE=format('%s: the units add up to %s but the line quantity is %s. They must match exactly.',label,total,l.qty); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'quantity',quantity) ORDER BY unit_kind,unit_label),'[]') INTO old FROM public.boq_unit_allocations WHERE link_set_id=p_set AND boq_item_id=p_item AND NOT is_archived;
 UPDATE public.boq_unit_allocations SET is_archived=true,updated_by=auth.uid(),updated_at=now() WHERE link_set_id=p_set AND boq_item_id=p_item AND NOT is_archived;
 INSERT INTO public.boq_unit_allocations(project_id,link_set_id,boq_item_id,unit_kind,unit_label,quantity,created_by,updated_by)
  SELECT p_project,p_set,p_item,e->>'unit_kind',e->>'unit_label',(e->>'quantity')::numeric,auth.uid(),auth.uid() FROM jsonb_array_elements(p_allocs) e WHERE (e->>'quantity')::numeric>0;
 UPDATE public.boq_task_links k SET is_archived=true,updated_by=auth.uid(),updated_at=now() WHERE k.link_set_id=p_set AND k.boq_item_id=p_item AND NOT k.is_archived
  AND NOT EXISTS(SELECT 1 FROM public.boq_unit_allocations a2 WHERE a2.link_set_id=p_set AND a2.boq_item_id=p_item AND NOT a2.is_archived AND a2.unit_kind=k.unit_kind AND a2.unit_label=k.unit_label);
 SELECT coalesce(jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'quantity',quantity) ORDER BY unit_kind,unit_label),'[]') INTO neu FROM public.boq_unit_allocations WHERE link_set_id=p_set AND boq_item_id=p_item AND NOT is_archived;
 INSERT INTO public.boq_link_audit(project_id,link_set_id,boq_item_id,action,reason,old_value,new_value,created_by,updated_by) VALUES(p_project,p_set,p_item,CASE WHEN p_reason IS NULL THEN 'split' ELSE 'revision_split' END,p_reason,old,neu,auth.uid(),auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public._boq2_apply_shares(p_set uuid,p_project uuid,p_boq uuid,p_item uuid,p_kind text,p_label text,p_shares jsonb,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e jsonb; sp numeric; tid uuid; total numeric:=0; prob text; code text; old jsonb; neu jsonb; label text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.project_boq_items WHERE id=p_item AND boq_id=p_boq AND NOT is_archived) THEN RAISE EXCEPTION 'This line is not in the project''s current BOQ.' USING ERRCODE='42501'; END IF;
 label:=public._boq2_line_label(p_item);
 IF NOT EXISTS(SELECT 1 FROM public.boq_unit_allocations WHERE link_set_id=p_set AND boq_item_id=p_item AND unit_kind=p_kind AND unit_label=p_label AND NOT is_archived AND quantity>0) THEN RAISE EXCEPTION USING MESSAGE=format('%s: give %s %s a quantity in the split before sharing it across tasks.',label,p_kind,p_label); END IF;
 IF jsonb_typeof(p_shares) IS DISTINCT FROM 'array' OR jsonb_array_length(p_shares)=0 THEN RAISE EXCEPTION USING MESSAGE=format('%s: choose at least one task for %s %s.',label,p_kind,p_label); END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(p_shares) LOOP
  BEGIN sp:=(e->>'share_pct')::numeric; tid:=(e->>'task_id')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION USING MESSAGE=format('%s: each row needs a task and a valid share.',label); END;
  IF tid IS NULL OR sp IS NULL THEN RAISE EXCEPTION USING MESSAGE=format('%s: each row needs a task and a share.',label); END IF;
  code:=NULL; SELECT task_id_in_schedule INTO code FROM public.project_tasks WHERE id=tid;
  prob:=public._boq2_task_problem(tid,p_project,p_kind,p_label);
  IF prob IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=format('%s: task %s cannot be linked to %s %s because the %s.',label,coalesce(code,'(unknown)'),p_kind,p_label,prob); END IF;
  IF sp::text IN ('NaN','Infinity') OR sp<=0 OR sp>100 THEN RAISE EXCEPTION USING MESSAGE=format('%s: the share for task %s must be more than 0%% and at most 100%%.',label,code); END IF;
  IF sp<>round(sp,2) THEN RAISE EXCEPTION USING MESSAGE=format('%s: the share for task %s can have at most 2 decimals.',label,code); END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_shares) x WHERE x->>'task_id'=e->>'task_id')>1 THEN RAISE EXCEPTION USING MESSAGE=format('%s: task %s is listed twice.',label,code); END IF;
  total:=total+sp;
 END LOOP;
 IF total<>100 THEN RAISE EXCEPTION USING MESSAGE=format('%s: the shares for %s %s add up to %s%%. They must total exactly 100.00%%.',label,p_kind,p_label,to_char(total,'FM99990.00')); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('task_id',task_id,'share_pct',share_pct) ORDER BY task_id),'[]') INTO old FROM public.boq_task_links WHERE link_set_id=p_set AND boq_item_id=p_item AND unit_kind=p_kind AND unit_label=p_label AND NOT is_archived;
 UPDATE public.boq_task_links SET is_archived=true,updated_by=auth.uid(),updated_at=now() WHERE link_set_id=p_set AND boq_item_id=p_item AND unit_kind=p_kind AND unit_label=p_label AND NOT is_archived;
 INSERT INTO public.boq_task_links(project_id,link_set_id,boq_item_id,unit_kind,unit_label,task_id,share_pct,created_by,updated_by)
  SELECT p_project,p_set,p_item,p_kind,p_label,(x->>'task_id')::uuid,(x->>'share_pct')::numeric,auth.uid(),auth.uid() FROM jsonb_array_elements(p_shares) x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('task_id',k.task_id,'code',t.task_id_in_schedule,'share_pct',k.share_pct) ORDER BY t.task_id_in_schedule),'[]') INTO neu FROM public.boq_task_links k JOIN public.project_tasks t ON t.id=k.task_id WHERE k.link_set_id=p_set AND k.boq_item_id=p_item AND k.unit_kind=p_kind AND k.unit_label=p_label AND NOT k.is_archived;
 INSERT INTO public.boq_link_audit(project_id,link_set_id,boq_item_id,action,reason,old_value,new_value,created_by,updated_by) VALUES(p_project,p_set,p_item,CASE WHEN p_reason IS NULL THEN 'shares' ELSE 'revision_shares' END,p_reason,jsonb_build_object('unit',p_kind||' '||p_label,'shares',old),jsonb_build_object('unit',p_kind||' '||p_label,'shares',neu),auth.uid(),auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public.boq2_mutate(p_project uuid,p_action text,p_payload jsonb,p_expected_version integer DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h public.project_boq; s public.boq_link_sets; st jsonb; c jsonb; r text; uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL OR NOT public.boq2_can_write(p_project) THEN RAISE EXCEPTION 'You can view these links but not change them. Only BOQ writers or schedule editors on this project can.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.projects WHERE id=p_project AND NOT coalesce(is_archived,false) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project is not active.'; END IF;
 SELECT * INTO h FROM public.project_boq WHERE project_id=p_project AND NOT is_archived ORDER BY version_number DESC,uploaded_at DESC,id DESC LIMIT 1;
 IF h.id IS NULL THEN RAISE EXCEPTION 'This project has no BOQ yet.'; END IF;
 IF h.entry_mode='fresh' AND h.status<>'final' THEN RAISE EXCEPTION 'Finalise the fresh BOQ before linking it to tasks.'; END IF;
 SELECT * INTO s FROM public.boq_link_sets WHERE project_id=p_project AND NOT is_archived FOR UPDATE;
 IF s.id IS NULL THEN
  INSERT INTO public.boq_link_sets(project_id,boq_id,created_by,updated_by) VALUES(p_project,h.id,uid,uid) RETURNING * INTO s;
 END IF;
 IF p_expected_version IS NOT NULL AND p_expected_version<>s.version THEN RAISE EXCEPTION 'These links changed since you opened them. Reload and try again.'; END IF;
 IF p_action IN ('save_split','save_shares') THEN
  IF s.status='locked' THEN RAISE EXCEPTION 'The links are locked. Use a revision with a reason to change them.' USING ERRCODE='42501'; END IF;
  IF p_action='save_split' THEN PERFORM public._boq2_apply_split(s.id,p_project,h.id,(p_payload->>'boq_item_id')::uuid,p_payload->'allocations',NULL);
  ELSE PERFORM public._boq2_apply_shares(s.id,p_project,h.id,(p_payload->>'boq_item_id')::uuid,p_payload->>'unit_kind',p_payload->>'unit_label',p_payload->'shares',NULL); END IF;
 ELSIF p_action='lock' THEN
  IF s.status='locked' THEN RAISE EXCEPTION 'Links are already locked.'; END IF;
  st:=public._boq2_state(p_project);
  IF NOT (st->>'can_lock')::boolean THEN RAISE EXCEPTION USING MESSAGE=format('Cannot lock yet: %s',st->>'lock_reason'); END IF;
  UPDATE public.boq_link_sets SET status='locked',locked_at=now(),locked_by=uid WHERE id=s.id;
  INSERT INTO public.boq_link_audit(project_id,link_set_id,action,old_value,new_value,created_by,updated_by) VALUES(p_project,s.id,'lock',jsonb_build_object('status','draft'),jsonb_build_object('status','locked','totals',st->'totals'),uid,uid);
 ELSIF p_action='revise' THEN
  IF s.status<>'locked' THEN RAISE EXCEPTION 'The links are still a draft; change them directly.'; END IF;
  r:=btrim(coalesce(p_payload->>'reason',''));
  IF length(r)<5 THEN RAISE EXCEPTION 'Give a reason of at least 5 characters for this revision.'; END IF;
  IF jsonb_typeof(p_payload->'changes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'changes')=0 THEN RAISE EXCEPTION 'Add at least one change to the revision.'; END IF;
  FOR c IN SELECT * FROM jsonb_array_elements(p_payload->'changes') LOOP
   IF c->>'kind'='split' THEN PERFORM public._boq2_apply_split(s.id,p_project,h.id,(c->>'boq_item_id')::uuid,c->'allocations',r);
   ELSIF c->>'kind'='shares' THEN PERFORM public._boq2_apply_shares(s.id,p_project,h.id,(c->>'boq_item_id')::uuid,c->>'unit_kind',c->>'unit_label',c->'shares',r);
   ELSE RAISE EXCEPTION 'Unknown revision change.'; END IF;
  END LOOP;
  st:=public._boq2_state(p_project);
  IF st->>'coverage_reason' IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE=format('A revision must leave every line fully split and shared. %s',st->>'coverage_reason'); END IF;
  INSERT INTO public.boq_link_audit(project_id,link_set_id,action,reason,new_value,created_by,updated_by) VALUES(p_project,s.id,'revision',r,jsonb_build_object('changes',jsonb_array_length(p_payload->'changes'),'totals',st->'totals'),uid,uid);
 ELSE RAISE EXCEPTION 'Unknown action.'; END IF;
 UPDATE public.boq_link_sets SET version=version+1,boq_id=h.id,updated_by=uid,updated_at=now() WHERE id=s.id;
 RETURN public.boq2_get(p_project);
END $$;
CREATE OR REPLACE FUNCTION public.boq2_suggest_equal_split(p_project uuid,p_item uuid,p_units jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q numeric; n integer; sc integer; part numeric; hid uuid; e jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.boq2_can_read(p_project) THEN RAISE EXCEPTION 'You do not have access to this project''s BOQ links.' USING ERRCODE='42501'; END IF;
 SELECT id INTO hid FROM public.project_boq WHERE project_id=p_project AND NOT is_archived ORDER BY version_number DESC,uploaded_at DESC,id DESC LIMIT 1;
 SELECT coalesce(boq_qty,0) INTO q FROM public.project_boq_items WHERE id=p_item AND boq_id=hid AND NOT is_archived;
 IF NOT FOUND THEN RAISE EXCEPTION 'This line is not in the project''s current BOQ.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_units) IS DISTINCT FROM 'array' OR jsonb_array_length(p_units)=0 THEN RAISE EXCEPTION 'Choose at least one unit.'; END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(p_units) LOOP
  IF NOT EXISTS(SELECT 1 FROM public._boq2_units(p_project) u WHERE u.unit_kind=e->>'unit_kind' AND u.unit_label=e->>'unit_label') THEN RAISE EXCEPTION USING MESSAGE=format('Unit %s %s is not in this project''s schedule.',e->>'unit_kind',e->>'unit_label'); END IF;
 END LOOP;
 n:=jsonb_array_length(p_units); sc:=greatest(2,scale(q)); part:=trunc(q/n,sc);
 RETURN (SELECT jsonb_agg(jsonb_build_object('unit_kind',x.e->>'unit_kind','unit_label',x.e->>'unit_label','quantity',CASE WHEN x.o=n THEN q-part*(n-1) ELSE part END) ORDER BY x.o) FROM jsonb_array_elements(p_units) WITH ORDINALITY x(e,o));
END $$;
CREATE OR REPLACE FUNCTION public.boq2_suggest_copy_shares(p_project uuid,p_item uuid,p_from_kind text,p_from_label text,p_targets jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.boq2_can_read(p_project) THEN RAISE EXCEPTION 'You do not have access to this project''s BOQ links.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_targets) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Choose the units to copy to.'; END IF;
 WITH src AS (SELECT k.task_id,k.share_pct,t.library_task_id,t.task_id_in_schedule code FROM public.boq_task_links k JOIN public.boq_link_sets s ON s.id=k.link_set_id AND s.project_id=p_project AND NOT s.is_archived JOIN public.project_tasks t ON t.id=k.task_id AND t.project_id=p_project
   WHERE k.project_id=p_project AND k.boq_item_id=p_item AND k.unit_kind=p_from_kind AND k.unit_label=p_from_label AND NOT k.is_archived),
  cand AS (SELECT t.id,t.task_id_in_schedule,t.task_name,t.library_task_id,t.unit_kind,t.unit_label FROM public.project_tasks t WHERE t.project_id=p_project AND NOT coalesce(t.is_removed,false) AND t.task_type::text='task' AND NOT coalesce(t.is_qc_gate,false) AND NOT coalesce(t.is_payment_milestone,false)),
  tgt AS (SELECT e->>'unit_kind' uk,e->>'unit_label' ul FROM jsonb_array_elements(p_targets) e),
  mm AS (SELECT tg.uk,tg.ul,src.code,src.share_pct,x.n,x.mid,x.mcode,x.mname FROM tgt tg CROSS JOIN src LEFT JOIN LATERAL (SELECT count(*) n,min(c.id::text)::uuid mid,min(c.task_id_in_schedule) mcode,min(c.task_name) mname FROM cand c WHERE src.library_task_id IS NOT NULL AND c.library_task_id=src.library_task_id AND c.unit_kind=tg.uk AND c.unit_label=tg.ul) x ON true)
 SELECT coalesce(jsonb_agg(jsonb_build_object('unit_kind',tg.uk,'unit_label',tg.ul,
   'shares',coalesce((SELECT jsonb_agg(jsonb_build_object('task_id',mm.mid,'code',mm.mcode,'task_name',mm.mname,'share_pct',mm.share_pct) ORDER BY mm.mcode) FROM mm WHERE mm.uk=tg.uk AND mm.ul=tg.ul AND mm.n=1),'[]'),
   'unmatched',coalesce((SELECT jsonb_agg(jsonb_build_object('code',mm.code,'reason',CASE WHEN mm.n=0 THEN 'no matching task in this unit' ELSE 'more than one matching task in this unit' END)) FROM mm WHERE mm.uk=tg.uk AND mm.ul=tg.ul AND mm.n<>1),'[]'))),'[]') INTO result FROM tgt tg;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public._boq2_units(uuid), public._boq2_task_problem(uuid,uuid,text,text), public._boq2_state(uuid), public._boq2_line_label(uuid), public._boq2_apply_split(uuid,uuid,uuid,uuid,jsonb,text), public._boq2_apply_shares(uuid,uuid,uuid,uuid,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.boq2_can_write(uuid), public.boq2_can_read(uuid), public.boq2_get(uuid), public.boq2_mutate(uuid,text,jsonb,integer), public.boq2_suggest_equal_split(uuid,uuid,jsonb), public.boq2_suggest_copy_shares(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boq2_can_write(uuid), public.boq2_can_read(uuid), public.boq2_get(uuid), public.boq2_mutate(uuid,text,jsonb,integer), public.boq2_suggest_equal_split(uuid,uuid,jsonb), public.boq2_suggest_copy_shares(uuid,uuid,text,text,jsonb) TO authenticated, service_role;