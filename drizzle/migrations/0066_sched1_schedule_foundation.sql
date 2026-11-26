-- SCHED-1 schedule foundation
CREATE TABLE public.schedule_editor_roles(
  role public.app_role PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.schedule_editor_roles(role) VALUES
 ('planning_head'),('planning_engineer'),('head_of_projects'),('managing_director'),('super_admin');
GRANT SELECT ON public.schedule_editor_roles TO authenticated;
GRANT ALL ON public.schedule_editor_roles TO service_role;
ALTER TABLE public.schedule_editor_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read schedule editor roles" ON public.schedule_editor_roles FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));

-- Caller-bound: answers only for the calling user (or server context with no JWT).
CREATE OR REPLACE FUNCTION public.can_edit_schedule(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL
     AND (auth.uid() IS NULL OR _uid = auth.uid())
     AND public.is_active_staff(_uid)
     AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.schedule_editor_roles s ON s.role = ur.role WHERE ur.user_id = _uid)
$$;
REVOKE ALL ON FUNCTION public.can_edit_schedule(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_schedule(uuid) TO authenticated, service_role;

-- Audit log for schedule writes
CREATE TABLE public.schedule_audit_log(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  task_id uuid,
  entity text NOT NULL,
  action text NOT NULL,
  reason text,
  old_value jsonb,
  new_value jsonb,
  actor_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schedule_audit_log TO authenticated;
GRANT ALL ON public.schedule_audit_log TO service_role;
ALTER TABLE public.schedule_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schedule editors and Tier 1 read schedule audit" ON public.schedule_audit_log FOR SELECT TO authenticated
  USING (public.can_edit_schedule(auth.uid()) OR public.is_tier1_or_super(auth.uid()));

-- B. Task library
CREATE TABLE public.schedule_library_activities(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('design','factory','site')),
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(), updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.schedule_library_tasks(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.schedule_library_activities(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  default_days int NOT NULL DEFAULT 1 CHECK (default_days >= 1),
  qty numeric, unit text, output_per_person_day numeric,
  crew jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_tracked boolean NOT NULL DEFAULT true,
  is_hold boolean NOT NULL DEFAULT false,
  entry_mode text NOT NULL DEFAULT 'pct' CHECK (entry_mode IN ('pct','qty')),
  is_qc_gate boolean NOT NULL DEFAULT false,
  is_payment_milestone boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(), updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.schedule_library_tasks(activity_id);
GRANT SELECT, INSERT, UPDATE ON public.schedule_library_activities, public.schedule_library_tasks TO authenticated;
GRANT ALL ON public.schedule_library_activities, public.schedule_library_tasks TO service_role;
ALTER TABLE public.schedule_library_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_library_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read library activities" ON public.schedule_library_activities FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Editors add library activities" ON public.schedule_library_activities FOR INSERT TO authenticated WITH CHECK (public.can_edit_schedule(auth.uid()));
CREATE POLICY "Editors update library activities" ON public.schedule_library_activities FOR UPDATE TO authenticated USING (public.can_edit_schedule(auth.uid())) WITH CHECK (public.can_edit_schedule(auth.uid()));
CREATE POLICY "Staff read library tasks" ON public.schedule_library_tasks FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Editors add library tasks" ON public.schedule_library_tasks FOR INSERT TO authenticated WITH CHECK (public.can_edit_schedule(auth.uid()));
CREATE POLICY "Editors update library tasks" ON public.schedule_library_tasks FOR UPDATE TO authenticated USING (public.can_edit_schedule(auth.uid())) WITH CHECK (public.can_edit_schedule(auth.uid()));

-- C. Calendar (deactivate, never delete)
CREATE TABLE public.schedule_holidays(
  holiday_date date PRIMARY KEY,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(), updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.schedule_holidays TO authenticated;
GRANT ALL ON public.schedule_holidays TO service_role;
ALTER TABLE public.schedule_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read holidays" ON public.schedule_holidays FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Editors add holidays" ON public.schedule_holidays FOR INSERT TO authenticated WITH CHECK (public.can_edit_schedule(auth.uid()));
CREATE POLICY "Editors update holidays" ON public.schedule_holidays FOR UPDATE TO authenticated USING (public.can_edit_schedule(auth.uid())) WITH CHECK (public.can_edit_schedule(auth.uid()));

CREATE OR REPLACE FUNCTION public.schedule_is_working_day(d date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(isodow FROM d) <> 7
     AND NOT EXISTS (SELECT 1 FROM public.schedule_holidays h WHERE h.holiday_date = d AND h.is_active)
$$;

-- Working day n, counting day1 (rolled forward to a working day) as day 1.
CREATE OR REPLACE FUNCTION public.schedule_working_date(day1 date, n int)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := day1; c int := 1;
BEGIN
  IF day1 IS NULL OR n IS NULL THEN RETURN NULL; END IF;
  IF n < 1 OR n > 3650 THEN RAISE EXCEPTION 'Working day number must be between 1 and 3650'; END IF;
  WHILE NOT public.schedule_is_working_day(d) LOOP d := d + 1; END LOOP;
  WHILE c < n LOOP
    d := d + 1;
    IF public.schedule_is_working_day(d) THEN c := c + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

-- Working days from a to b inclusive; negative when b is before a.
CREATE OR REPLACE FUNCTION public.schedule_working_days_between(a date, b date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL
    WHEN b >= a THEN (SELECT count(*)::int FROM generate_series(a, b, interval '1 day') g WHERE public.schedule_is_working_day(g::date))
    ELSE -(SELECT count(*)::int FROM generate_series(b, a, interval '1 day') g WHERE public.schedule_is_working_day(g::date)) END
$$;
REVOKE ALL ON FUNCTION public.schedule_is_working_day(date), public.schedule_working_date(date,int), public.schedule_working_days_between(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_is_working_day(date), public.schedule_working_date(date,int), public.schedule_working_days_between(date,date) TO authenticated, service_role;

-- D. Per-project unit Day 1
CREATE TABLE public.project_schedule_units(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  unit_kind text NOT NULL CHECK (unit_kind IN ('module','panel_set','site')),
  unit_label text NOT NULL,
  day1 date,
  offset_note text,
  created_by uuid DEFAULT auth.uid(), updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, unit_kind, unit_label)
);
GRANT SELECT, INSERT, UPDATE ON public.project_schedule_units TO authenticated;
GRANT ALL ON public.project_schedule_units TO service_role;
ALTER TABLE public.project_schedule_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project staff read schedule units" ON public.project_schedule_units FOR SELECT TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));
CREATE POLICY "Editors add schedule units" ON public.project_schedule_units FOR INSERT TO authenticated WITH CHECK (public.can_edit_schedule(auth.uid()) AND public.user_can_access_project(auth.uid(), project_id));
CREATE POLICY "Editors update schedule units" ON public.project_schedule_units FOR UPDATE TO authenticated USING (public.can_edit_schedule(auth.uid()) AND public.user_can_access_project(auth.uid(), project_id)) WITH CHECK (public.can_edit_schedule(auth.uid()) AND public.user_can_access_project(auth.uid(), project_id));
INSERT INTO public.project_schedule_units(project_id, unit_kind, unit_label, created_by, updated_by)
SELECT DISTINCT m.project_id, 'module', btrim(coalesce(nullif(btrim(m.module_code),''), m.name)), NULL::uuid, NULL::uuid
FROM public.modules m
WHERE NOT coalesce(m.is_archived,false) AND m.project_id IS NOT NULL AND nullif(btrim(coalesce(nullif(btrim(m.module_code),''), m.name)),'') IS NOT NULL
ON CONFLICT DO NOTHING;

-- E. project_tasks: new nullable columns, editor-only add/remove, baseline lock
ALTER TABLE public.project_tasks
  ADD COLUMN library_task_id uuid REFERENCES public.schedule_library_tasks(id),
  ADD COLUMN start_day int,
  ADD COLUMN unit_kind text,
  ADD COLUMN unit_label text,
  ADD COLUMN baseline_version int;

DROP POLICY "Planning/production/ops can insert project tasks" ON public.project_tasks;
DROP POLICY "Planning/ops can delete project tasks" ON public.project_tasks;
CREATE POLICY "Schedule editors can insert project tasks" ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (public.can_edit_schedule(auth.uid()));
CREATE POLICY "Schedule editors can delete project tasks" ON public.project_tasks FOR DELETE TO authenticated USING (public.can_edit_schedule(auth.uid()));

CREATE OR REPLACE FUNCTION public.project_tasks_baseline_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_revise boolean := coalesce(current_setting('hstack.schedule_revise', true), '') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_revise THEN NEW.baseline_version := NULL; END IF;
    RETURN NEW;
  END IF;
  IF NEW.baseline_version IS DISTINCT FROM OLD.baseline_version AND NOT v_revise THEN
    RAISE EXCEPTION 'Baseline version is set only by publishing a baseline' USING ERRCODE = '42501';
  END IF;
  IF (NEW.project_id, NEW.task_name, NEW.duration_days, NEW.planned_start_date, NEW.planned_finish_date,
      NEW.predecessor_ids, NEW.display_order, NEW.phase, NEW.stage_name, NEW.parent_task_id, NEW.parent_stage_number,
      NEW.responsible_role, NEW.library_task_id, NEW.start_day, NEW.unit_kind, NEW.unit_label)
     IS DISTINCT FROM
     (OLD.project_id, OLD.task_name, OLD.duration_days, OLD.planned_start_date, OLD.planned_finish_date,
      OLD.predecessor_ids, OLD.display_order, OLD.phase, OLD.stage_name, OLD.parent_task_id, OLD.parent_stage_number,
      OLD.responsible_role, OLD.library_task_id, OLD.start_day, OLD.unit_kind, OLD.unit_label) THEN
    IF v_revise THEN RETURN NEW; END IF;
    IF OLD.baseline_version IS NOT NULL THEN
      RAISE EXCEPTION 'This task is in a published baseline; change it with a schedule revision and a reason' USING ERRCODE = '42501';
    END IF;
    IF current_user IN ('authenticated','anon') AND NOT public.can_edit_schedule(auth.uid()) THEN
      RAISE EXCEPTION 'Only the planning office can change schedule dates, durations or task details' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_project_tasks_baseline_guard BEFORE INSERT OR UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.project_tasks_baseline_guard();

-- F. Baselines and revisions
CREATE TABLE public.schedule_baselines(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  version int NOT NULL CHECK (version >= 1),
  kind text NOT NULL CHECK (kind IN ('baseline','revision')),
  reason text,
  published_by uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL,
  UNIQUE (project_id, version)
);
GRANT SELECT ON public.schedule_baselines TO authenticated;
GRANT SELECT ON public.schedule_baselines TO service_role;
ALTER TABLE public.schedule_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project staff read baselines" ON public.schedule_baselines FOR SELECT TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));

CREATE OR REPLACE FUNCTION public.publish_schedule_baseline(p_project_id uuid, p_reason text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_ver int; v_snap jsonb; v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
BEGIN
  IF v_uid IS NULL OR NOT public.can_edit_schedule(v_uid) OR NOT public.user_can_access_project(v_uid, p_project_id) THEN
    RAISE EXCEPTION 'Only the planning office can publish a schedule baseline' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:' || p_project_id::text));
  PERFORM 1 FROM public.project_tasks WHERE project_id = p_project_id FOR UPDATE;
  SELECT coalesce(max(version),0) + 1 INTO v_ver FROM public.schedule_baselines WHERE project_id = p_project_id;
  IF v_ver > 1 AND v_reason IS NULL THEN RAISE EXCEPTION 'A reason is required to publish revision %', v_ver USING ERRCODE = '22023'; END IF;
  SELECT jsonb_agg(jsonb_build_object('id',t.id,'task_id_in_schedule',t.task_id_in_schedule,'task_name',t.task_name,'duration_days',t.duration_days,
           'planned_start_date',t.planned_start_date,'planned_finish_date',t.planned_finish_date,'predecessor_ids',t.predecessor_ids,
           'display_order',t.display_order,'phase',t.phase,'stage_name',t.stage_name,'parent_task_id',t.parent_task_id,
           'parent_stage_number',t.parent_stage_number,'responsible_role',t.responsible_role,'library_task_id',t.library_task_id,
           'start_day',t.start_day,'unit_kind',t.unit_kind,'unit_label',t.unit_label) ORDER BY t.display_order NULLS LAST, t.task_id_in_schedule, t.id)
    INTO v_snap FROM public.project_tasks t WHERE t.project_id = p_project_id;
  IF v_snap IS NULL THEN RAISE EXCEPTION 'This project has no schedule tasks to publish'; END IF;
  INSERT INTO public.schedule_baselines(project_id, version, kind, reason, published_by, snapshot)
  VALUES (p_project_id, v_ver, CASE WHEN v_ver = 1 THEN 'baseline' ELSE 'revision' END, v_reason, v_uid, v_snap);
  PERFORM set_config('hstack.schedule_revise', 'on', true);
  UPDATE public.project_tasks SET baseline_version = v_ver WHERE project_id = p_project_id;
  PERFORM set_config('hstack.schedule_revise', '', true);
  INSERT INTO public.schedule_audit_log(project_id, entity, action, reason, new_value, actor_id)
  VALUES (p_project_id, 'schedule_baseline', 'publish', v_reason, jsonb_build_object('version', v_ver, 'task_count', jsonb_array_length(v_snap)), v_uid);
  RETURN v_ver;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_revise_task(p_task_id uuid, p_patch jsonb, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); t public.project_tasks%ROWTYPE; n public.project_tasks%ROWTYPE; v_bad text;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_keys text[] := ARRAY['task_name','duration_days','planned_start_date','planned_finish_date','predecessor_ids','display_order','phase','stage_name','parent_task_id','parent_stage_number','responsible_role','library_task_id','start_day','unit_kind','unit_label'];
BEGIN
  SELECT * INTO t FROM public.project_tasks WHERE id = p_task_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF v_uid IS NULL OR NOT public.can_edit_schedule(v_uid) OR NOT public.user_can_access_project(v_uid, t.project_id) THEN
    RAISE EXCEPTION 'Only the planning office can revise the schedule' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schedule_baselines WHERE project_id = t.project_id) THEN
    RAISE EXCEPTION 'Publish a baseline before revising tasks' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'A reason is required for a schedule revision' USING ERRCODE = '22023'; END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN RAISE EXCEPTION 'Nothing to change'; END IF;
  SELECT k INTO v_bad FROM jsonb_object_keys(p_patch) k WHERE NOT (k = ANY(v_keys)) LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Field % cannot be revised', v_bad USING ERRCODE = '22023'; END IF;
  IF p_patch ? 'duration_days' AND (p_patch->>'duration_days')::int < 0 THEN RAISE EXCEPTION 'Duration cannot be negative'; END IF;
  PERFORM set_config('hstack.schedule_revise', 'on', true);
  UPDATE public.project_tasks SET
    task_name = CASE WHEN p_patch ? 'task_name' THEN p_patch->>'task_name' ELSE task_name END,
    duration_days = CASE WHEN p_patch ? 'duration_days' THEN (p_patch->>'duration_days')::int ELSE duration_days END,
    planned_start_date = CASE WHEN p_patch ? 'planned_start_date' THEN (p_patch->>'planned_start_date')::date ELSE planned_start_date END,
    planned_finish_date = CASE WHEN p_patch ? 'planned_finish_date' THEN (p_patch->>'planned_finish_date')::date ELSE planned_finish_date END,
    predecessor_ids = CASE WHEN p_patch ? 'predecessor_ids' THEN ARRAY(SELECT jsonb_array_elements_text(coalesce(nullif(p_patch->'predecessor_ids','null'::jsonb),'[]'::jsonb))) ELSE predecessor_ids END,
    display_order = CASE WHEN p_patch ? 'display_order' THEN (p_patch->>'display_order')::int ELSE display_order END,
    phase = CASE WHEN p_patch ? 'phase' THEN p_patch->>'phase' ELSE phase END,
    stage_name = CASE WHEN p_patch ? 'stage_name' THEN p_patch->>'stage_name' ELSE stage_name END,
    parent_task_id = CASE WHEN p_patch ? 'parent_task_id' THEN (p_patch->>'parent_task_id')::uuid ELSE parent_task_id END,
    parent_stage_number = CASE WHEN p_patch ? 'parent_stage_number' THEN p_patch->>'parent_stage_number' ELSE parent_stage_number END,
    responsible_role = CASE WHEN p_patch ? 'responsible_role' THEN p_patch->>'responsible_role' ELSE responsible_role END,
    library_task_id = CASE WHEN p_patch ? 'library_task_id' THEN (p_patch->>'library_task_id')::uuid ELSE library_task_id END,
    start_day = CASE WHEN p_patch ? 'start_day' THEN (p_patch->>'start_day')::int ELSE start_day END,
    unit_kind = CASE WHEN p_patch ? 'unit_kind' THEN p_patch->>'unit_kind' ELSE unit_kind END,
    unit_label = CASE WHEN p_patch ? 'unit_label' THEN p_patch->>'unit_label' ELSE unit_label END,
    updated_at = now()
  WHERE id = p_task_id RETURNING * INTO n;
  PERFORM set_config('hstack.schedule_revise', '', true);
  INSERT INTO public.schedule_audit_log(project_id, task_id, entity, action, reason, old_value, new_value, actor_id)
  VALUES (t.project_id, t.id, 'project_task', 'revise', v_reason,
    (SELECT jsonb_object_agg(k, to_jsonb(t)->k) FROM unnest(v_keys) k WHERE p_patch ? k),
    (SELECT jsonb_object_agg(k, to_jsonb(n)->k) FROM unnest(v_keys) k WHERE p_patch ? k), v_uid);
  RETURN (SELECT jsonb_object_agg(k, to_jsonb(n)->k) FROM unnest(v_keys) k WHERE p_patch ? k);
END $$;
REVOKE ALL ON FUNCTION public.publish_schedule_baseline(uuid,text), public.schedule_revise_task(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_schedule_baseline(uuid,text), public.schedule_revise_task(uuid,jsonb,text) TO authenticated;

-- G. Comments from site
CREATE TABLE public.schedule_task_comments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id),
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','seen','resolved')),
  resolved_by uuid, resolved_at timestamptz,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.schedule_task_comments(task_id);
CREATE INDEX ON public.schedule_task_comments(project_id, status);
GRANT SELECT, INSERT (project_id, task_id, body) ON public.schedule_task_comments TO authenticated;
GRANT UPDATE (status) ON public.schedule_task_comments TO authenticated;
GRANT ALL ON public.schedule_task_comments TO service_role;
ALTER TABLE public.schedule_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project staff read schedule comments" ON public.schedule_task_comments FOR SELECT TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));
CREATE POLICY "Project staff add schedule comments" ON public.schedule_task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND status = 'open' AND public.is_active_staff(auth.uid()) AND public.user_can_access_project(auth.uid(), project_id));
CREATE POLICY "Editors update schedule comment status" ON public.schedule_task_comments FOR UPDATE TO authenticated
  USING (public.can_edit_schedule(auth.uid()) AND public.user_can_access_project(auth.uid(), project_id))
  WITH CHECK (public.can_edit_schedule(auth.uid()) AND public.user_can_access_project(auth.uid(), project_id));

CREATE OR REPLACE FUNCTION public.schedule_comment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE id = NEW.task_id AND project_id = NEW.project_id) THEN
      RAISE EXCEPTION 'Task is not in this project';
    END IF;
    NEW.status := 'open'; NEW.resolved_by := NULL; NEW.resolved_at := NULL;
    RETURN NEW;
  END IF;
  IF (NEW.project_id, NEW.task_id, NEW.author_id, NEW.body, NEW.created_at) IS DISTINCT FROM (OLD.project_id, OLD.task_id, OLD.author_id, OLD.body, OLD.created_at) THEN
    RAISE EXCEPTION 'Only the comment status can change' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.updated_by := auth.uid(); NEW.updated_at := now();
    IF NEW.status = 'resolved' THEN NEW.resolved_by := auth.uid(); NEW.resolved_at := now();
    ELSE NEW.resolved_by := NULL; NEW.resolved_at := NULL; END IF;
    INSERT INTO public.schedule_audit_log(project_id, task_id, entity, action, old_value, new_value, actor_id)
    VALUES (NEW.project_id, NEW.task_id, 'schedule_task_comment', 'status', jsonb_build_object('id',OLD.id,'status',OLD.status), jsonb_build_object('id',NEW.id,'status',NEW.status), auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_schedule_comment_guard BEFORE INSERT OR UPDATE ON public.schedule_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.schedule_comment_guard();

CREATE OR REPLACE FUNCTION public.schedule_comment_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_task text; v_msg text;
BEGIN
  SELECT coalesce(task_id_in_schedule || ' ', '') || coalesce(task_name, '') INTO v_task FROM public.project_tasks WHERE id = NEW.task_id;
  v_msg := 'New schedule comment on ' || coalesce(v_task, 'a task') || ': ' || left(NEW.body, 200);
  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
           WHERE ur.role IN ('planning_head','head_of_projects') AND ur.user_id <> NEW.author_id AND public.is_active_staff(ur.user_id) LOOP
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority, related_table, related_id)
    VALUES (r.user_id, 'info', 'schedule', 'Schedule comment from site', v_msg, v_msg, '/projects/' || NEW.project_id, 'normal', 'schedule_task_comments', NEW.id);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_schedule_comment_notify AFTER INSERT ON public.schedule_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.schedule_comment_notify();