# SCHED-2a — CONFIRM

## Result and scope

Venkat can edit schedules as a **named individual**, while `head_operations` itself remains excluded. Published projects can close and still create their archive and AMC follow-up tasks. Server-side functions now calculate pre-baseline dates, add library tasks, and repeat factory tasks within one project.

No screen, route, navigation item, feature flag, cron job, scheduled task, reminder, password, account activation state or `schedule_editor_roles` content changed. Daily Report, Running Bill, Project Cost, attendance, expenses and Project Rates were untouched. No existing task was deleted or rebuilt; no upload was run; no previous-project copy feature exists.

**Migration history:** the main change is `0070_sched2a_named_editors_server_dates.sql`. Rollback testing exposed two implementation errors before any fixture persisted: a missing task-type enum cast and a PL/pgSQL variable/column collision. These were corrected transparently in `0071_sched2a_library_task_type_cast.sql` and `0072_sched2a_recalculate_variable_resolution.sql`. Thus three migrations were applied, rather than rewriting applied history. Venkat's single named-editor row was inserted separately through the data-write tool, as required by the platform's DDL-only migration rule.

## 1. INSPECT evidence

### Predecessor representation

`project_tasks.predecessor_ids` contains **`task_id_in_schedule` text codes**, not task UUIDs. Five real rows on Test project - 1:

| task_id_in_schedule | Task | predecessor_ids |
|---|---|---|
| 1.2 | Concept design and layout development | `{1.1}` |
| 1.3 | Structural design — module framing and connections | `{1.2}` |
| 1.4 | MEP design — electrical, plumbing, HVAC | `{1.2}` |
| 1.5 | Design coordination and clash detection | `{1.3,1.4}` |
| 1.6 | GFC drawing package — 18-section QC checklist | `{1.5}` |

All new dependency logic resolves these codes in the same project and unit. Their meaning was not changed.

### Closure task writers

- `trg_project_closure_create_archive()` runs after project status becomes `closed`. It inserts `ARCHIVE-UPLOAD-<project prefix>`, phase `Closure`, responsible role `planning_engineer`, status `Upcoming`, current date through current date +3, then links `project_archives.karthik_upload_task_id` and writes existing notifications.
- `trg_project_closure_amc_followup()` runs on the same transition. It inserts `AMC-FU-<project prefix>`, phase `Post-Production`, responsible role `sales_director`, status `Pending`, current date through current date +7, completion 0, then writes the existing sales notification.
- Neither original function set a row marker or `baseline_version`; SCHED-1b therefore blocked both inserts after publication. The fix adds only the trusted transient `followup` mode around their existing fixed inserts. Their reminders, notifications, timing and business logic are otherwise unchanged.
- `trg_clone_templates_on_project_system_change()` calls `clone_task_templates_to_project()` for a changed production system only when no tasks exist. A published project has tasks, so the former trigger could silently do nothing; both trigger and clone function now explicitly reject a published-system change with the requested message.

### Venkat's authoritative account

Join used: `user_roles.user_id = profiles.auth_user_id`, with `auth.users.id = profiles.auth_user_id` for the email lookup.

- Email: `designblr3@altree.in`
- Exactly **1** matching auth account and **1** matching profile.
- Auth user id: **`e7554a18-8a12-4f45-b81d-468426c64f8b`**
- Existing role: `head_operations`
- Sole named-editor row note: `Head of design team (Venkat)`

`schedule_editor_roles` remains exactly `planning_head`, `planning_engineer`, `head_of_projects`, `managing_director`, `super_admin`. No other named editor exists.

## 2. Implemented rules

### Named editors

`schedule_editor_users` has a primary-key/FK on the auth user, optional note, actor and timestamp. Active staff can read it; authenticated clients have no insert/update/delete grant or policy. `can_edit_schedule` remains caller-bound and active-staff-only, and now ORs the unchanged role set with this named-user table.

### Follow-up guard and snapshots

The membership guard accepts `followup` only in the two closure-function owner contexts and validates the fixed code, phase, role, status and date shape. It does not permit arbitrary closure tasks or deletes. Follow-ups retain default `work_category='process'` and `baseline_version=NULL`.

Publishing excludes unversioned `ARCHIVE-UPLOAD-%` and `AMC-FU-%` follow-ups from both the snapshot and version stamping. Pending schedule-revision tasks remain included, preserving SCHED-1b behavior.

### Server dates

`schedule_recalculate_dates` locks the project schedule, verifies editor + project access + no baseline, locks active task rows, validates predecessors, resolves start days in dependency order, detects cycles, and calculates dates using Sundays plus active holidays. It writes only `start_day`, `planned_start_date`, and `planned_finish_date` (the pre-existing update trigger maintains `updated_at`). It audits the count/warnings and returns them as JSON.

- Predecessors are finish-to-start with no lag.
- Zero-day milestones have equal start/end days.
- Missing predecessors and cycles abort the whole calculation.
- Missing unit Day 1 produces NULL dates and a unit warning.
- A task without a unit uses the earliest non-null module Day 1 and warns.

### Library insertion and same-project repetition

`schedule_add_library_tasks` is editor/project checked and pre-baseline only. Module codes receive `-<unit label>`. It copies library name/default duration/standard start, activity phase, library id, display/QC/payment fields, and maps site work to the existing `construction` category and other work to `process`. Missing standard start days use the next free working-day number. Existing library rows for that unit are skipped. Each insert is audited.

`schedule_repeat_for_units` is editor/project checked and pre-baseline only. It reads factory-phase tasks from one source unit **where `project_id` equals the requested project only**, copies them to target unit labels, suffixes codes per target, and remaps predecessor codes. Planned dates are left for server recalculation. Existing target codes are skipped; every inserted row is audited.

## 3. Real-principal rollback test evidence

Tests used existing active accounts, `SET LOCAL ROLE authenticated`, transaction-local JWT subject claims, and actual database functions/RLS/triggers. Every block ended with an intentional `P0001` evidence exception, rolling back all fixtures. Unexpected success in a negative check failed the test.

| Required check | Observed result |
|---|---|
| (a) Venkat | `can_edit_schedule` true using his real auth id. |
| (a) Other head_operations | No second live head_operations account exists. An existing site_engineer received a **temporary, transaction-local head_operations role fixture**; `can_edit_schedule` remained false. Role row count after rollback: 0. |
| (a) Existing editor roles | Real planning_engineer, planning_head and head_of_projects accounts all remained editors. Real site_engineer was not. |
| (b) Published closure | Status changed to closed successfully. Archive and AMC tasks both existed, baseline_version NULL, work_category process, archive linkage preserved. |
| (b) Later snapshot | Version 2 excluded both follow-up ids; both stayed NULL while the normal task stamped version 2. |
| (c) Production-system change | UPDATE rejected **42501** with exactly: `This project has a published baseline; change the production system through a schedule revision.` Original `modular` value remained. |
| (d) Dependency chain | A 3d → B 2d → C 1d produced start_days **1, 4, 6**. |
| (d) Calendar | Day 1 Monday 02/11/2026; holiday Wednesday 04/11 and Sunday 08/11 skipped. Saturday remained a working day as required. A: 02/11–05/11; B: 06/11–07/11; C: 09/11. |
| (d) Cycle | Rejected **22023** with `Schedule dependency cycle` naming S2D-B and S2D-C. |
| (d) Missing predecessor | Rejected **22023**, naming `NO-SUCH-PREDECESSOR` and same project/unit. |
| (d) Missing Day 1 | Both dates NULL; warnings named module/S2NONE. No-unit fallback used earliest module Day 1 and warned. |
| (d) Milestone | Zero-day task had equal start/end day and equal 09/11 dates. |
| (d) After publish | Recalculation rejected **42501**. Successful recalculation was audited. |
| (e) Library insertion | Three requested module rows had correct codes/names/factory phase/durations/standard starts/process category. Second call returned count 0, skipped 3; total remained 3. |
| (e) Library restrictions | site_engineer rejected **42501**; after baseline rejected **42501**. |
| (f) Unit repetition | One source copied to two targets: four rows with R90/R91-S2T1/S2T2 codes, durations preserved and predecessors remapped to the matching target. All source/target reads were project-scoped. |
| (g) Non-editor calls | All three new functions rejected **42501**. |

Retained executable evidence:

- `src/test/sched2a-access-library.rollback.sql`
- `src/test/sched2a-dates.rollback.sql`
- `src/test/sched2a-closure.rollback.sql`

Post-rollback reads found zero SCHED-2a test tasks, memberships, temporary role rows, baselines, holidays or recalculation/library/repeat audit rows. Test project returned to its prior state; only Venkat's requested named-editor row remains.

## 4. Existing automated tests

**66 files, 955 tests passed, 0 failed, 0 skipped** using `bunx vitest run --maxWorkers=2 --minWorkers=1`. Preview build log remained `build OK` after generated type updates.

## 5. Not verified / boundaries

- No browser or screen flow was tested because no screen or caller was added. The future builder still needs to call these checked functions.
- Closure was tested at the database trigger level, including existing notification inserts; no email delivery, Zoho upload or physical archive download was attempted.
- The second-head_operations negative check required the disclosed rollback-only role fixture because no second live account holds that role.
- No security scan finding was bulk-fixed or suppressed; no clean-scan claim is made.
- Database and generated types are already live in the shared backend. **Publish > Update is not needed for this database-only delivery.**

## 6. Exact final SQL

The following definitions are copied verbatim from the applied migrations; later corrective definitions supersede the same-named function in 0070.

### can_edit_schedule

Source: `drizzle/migrations/0070_sched2a_named_editors_server_dates.sql`.

```sql
CREATE OR REPLACE FUNCTION public.can_edit_schedule(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _uid IS NOT NULL
     AND (auth.uid() IS NULL OR _uid=auth.uid())
     AND public.is_active_staff(_uid)
     AND (EXISTS(
       SELECT 1 FROM public.user_roles ur
       JOIN public.schedule_editor_roles sr ON sr.role=ur.role
       WHERE ur.user_id=_uid
     ) OR EXISTS(
       SELECT 1 FROM public.schedule_editor_users su WHERE su.user_id=_uid
     ))
$$;
```

### Follow-up membership guard

Source: `drizzle/migrations/0070_sched2a_named_editors_server_dates.sql`.

```sql
CREATE OR REPLACE FUNCTION public.schedule_task_membership_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  p uuid;
  mode text:=coalesce(current_setting('hstack.schedule_membership',true),'');
  trusted boolean:=current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.schedule_add_task(uuid,jsonb,text)'::regprocedure));
  followup boolean:=mode='followup' AND (
    current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.trg_project_closure_create_archive()'::regprocedure))
    OR current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.trg_project_closure_amc_followup()'::regprocedure))
  );
  fixed_followup boolean:=false;
BEGIN
  p:=CASE WHEN TG_OP='DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p::text));
  IF TG_OP='INSERT' AND followup THEN
    fixed_followup:=
      (NEW.task_id_in_schedule='ARCHIVE-UPLOAD-'||substr(NEW.project_id::text,1,8)
       AND NEW.phase='Closure' AND NEW.responsible_role='planning_engineer'
       AND NEW.status='Upcoming' AND NEW.task_type='task'
       AND NEW.planned_start_date=CURRENT_DATE AND NEW.planned_finish_date=CURRENT_DATE+3)
      OR
      (NEW.task_id_in_schedule='AMC-FU-'||substr(NEW.project_id::text,1,8)
       AND NEW.phase='Post-Production' AND NEW.responsible_role='sales_director'
       AND NEW.status='Pending' AND NEW.completion_percentage=0
       AND NEW.planned_start_date=CURRENT_DATE AND NEW.planned_finish_date=CURRENT_DATE+7);
  END IF;
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p) THEN
    IF TG_OP='DELETE' OR NOT ((trusted AND mode IN ('add','handover')) OR fixed_followup) THEN
      RAISE EXCEPTION 'Published schedule membership requires a reasoned revision; tasks must be archived, not deleted' USING ERRCODE='42501';
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.baseline_version:=NULL;
    NEW.is_removed:=false;
    NEW.removed_at:=NULL;
    NEW.removed_by:=NULL;
    NEW.removed_reason:=NULL;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
```

### schedule_recalculate_dates

Source: `drizzle/migrations/0072_sched2a_recalculate_variable_resolution.sql`.

```sql
CREATE OR REPLACE FUNCTION public.schedule_recalculate_dates(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_column
DECLARE
  u uuid:=auth.uid(); t public.project_tasks%ROWTYPE;
  v_done uuid[]:=ARRAY[]::uuid[]; v_ids uuid[]; v_path uuid[];
  v_total int; v_next int; v_day1 date; v_start int; v_end int;
  v_code text; v_name text; v_pred text; v_cycle text;
  v_warnings jsonb:='[]'::jsonb; v_result jsonb;
BEGIN
  IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN
    RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p_project_id) THEN
    RAISE EXCEPTION 'Published schedule dates require a revision and reason' USING ERRCODE='42501';
  END IF;
  PERFORM id FROM public.project_tasks WHERE project_id=p_project_id AND NOT is_removed FOR UPDATE;
  SELECT count(*) INTO v_total FROM public.project_tasks WHERE project_id=p_project_id AND NOT is_removed;
  IF EXISTS(SELECT 1 FROM public.project_tasks WHERE project_id=p_project_id AND NOT is_removed AND coalesce(duration_days,0)<0) THEN
    RAISE EXCEPTION 'Task duration cannot be negative' USING ERRCODE='22023';
  END IF;
  SELECT t.task_id_in_schedule,t.task_name,pred INTO v_code,v_name,v_pred
  FROM public.project_tasks t CROSS JOIN LATERAL unnest(coalesce(t.predecessor_ids,ARRAY[]::text[])) pred
  LEFT JOIN public.project_tasks p ON p.project_id=t.project_id AND NOT p.is_removed
    AND p.task_id_in_schedule=pred
    AND p.unit_kind IS NOT DISTINCT FROM t.unit_kind AND p.unit_label IS NOT DISTINCT FROM t.unit_label
  WHERE t.project_id=p_project_id AND NOT t.is_removed AND p.id IS NULL LIMIT 1;
  IF v_code IS NOT NULL THEN
    RAISE EXCEPTION 'Task % (%): predecessor % does not exist in the same project/unit',v_code,v_name,v_pred USING ERRCODE='22023';
  END IF;
  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO v_done
  FROM public.project_tasks
  WHERE project_id=p_project_id AND NOT is_removed AND coalesce(cardinality(predecessor_ids),0)=0;
  LOOP
    WITH updated AS(
      UPDATE public.project_tasks child SET start_day=x.next_start
      FROM(
        SELECT t.id,max(CASE WHEN coalesce(p.duration_days,0)=0 THEN p.start_day ELSE p.start_day+greatest(coalesce(p.duration_days,0),1)-1 END)+1 AS next_start
        FROM public.project_tasks t
        CROSS JOIN LATERAL unnest(t.predecessor_ids) pred
        JOIN public.project_tasks p ON p.id=ANY(v_done) AND p.project_id=t.project_id AND NOT p.is_removed
          AND p.task_id_in_schedule=pred
          AND p.unit_kind IS NOT DISTINCT FROM t.unit_kind AND p.unit_label IS NOT DISTINCT FROM t.unit_label
        WHERE t.project_id=p_project_id AND NOT t.is_removed AND NOT t.id=ANY(v_done)
        GROUP BY t.id HAVING count(*)=cardinality(t.predecessor_ids)
      ) x WHERE child.id=x.id RETURNING child.id
    )
    SELECT array_agg(id) INTO v_ids FROM updated;
    EXIT WHEN v_ids IS NULL;
    v_done:=v_done||v_ids;
  END LOOP;
  IF cardinality(v_done)<>v_total THEN
    WITH RECURSIVE walk(id,path,cycled) AS(
      SELECT t.id,ARRAY[t.id],false FROM public.project_tasks t
      WHERE t.project_id=p_project_id AND NOT t.is_removed AND NOT t.id=ANY(v_done)
      UNION ALL
      SELECT p.id,w.path||p.id,p.id=ANY(w.path)
      FROM walk w JOIN public.project_tasks cur ON cur.id=w.id
      CROSS JOIN LATERAL unnest(cur.predecessor_ids) pred
      JOIN public.project_tasks p ON p.project_id=cur.project_id AND NOT p.is_removed
        AND p.task_id_in_schedule=pred
        AND p.unit_kind IS NOT DISTINCT FROM cur.unit_kind AND p.unit_label IS NOT DISTINCT FROM cur.unit_label
      WHERE NOT w.cycled
    )
    SELECT path INTO v_path FROM walk WHERE cycled LIMIT 1;
    SELECT string_agg(task_id_in_schedule||' ('||task_name||')',' -> ' ORDER BY ord) INTO v_cycle
    FROM unnest(v_path) WITH ORDINALITY x(id,ord) JOIN public.project_tasks t ON t.id=x.id;
    RAISE EXCEPTION 'Schedule dependency cycle: %',v_cycle USING ERRCODE='22023';
  END IF;
  FOR t IN SELECT * FROM public.project_tasks WHERE project_id=p_project_id AND NOT is_removed ORDER BY display_order NULLS LAST,task_id_in_schedule,id LOOP
    v_day1:=NULL;
    IF t.unit_kind IS NOT NULL AND t.unit_label IS NOT NULL THEN
      SELECT day1 INTO v_day1 FROM public.project_schedule_units
      WHERE project_id=p_project_id AND unit_kind=t.unit_kind AND unit_label=t.unit_label;
      IF v_day1 IS NULL THEN
        v_warnings:=v_warnings||jsonb_build_array('No Day 1 for unit '||t.unit_kind||' / '||t.unit_label);
      END IF;
    ELSE
      SELECT min(day1) INTO v_day1 FROM public.project_schedule_units
      WHERE project_id=p_project_id AND unit_kind='module' AND day1 IS NOT NULL;
      v_warnings:=v_warnings||jsonb_build_array('Task '||t.task_id_in_schedule||' has no unit; using earliest module Day 1');
      IF v_day1 IS NULL THEN
        v_warnings:=v_warnings||jsonb_build_array('Task '||t.task_id_in_schedule||' has no unit and the project has no module Day 1');
      END IF;
    END IF;
    v_start:=t.start_day;
    v_end:=CASE WHEN coalesce(t.duration_days,0)=0 THEN v_start ELSE v_start+greatest(coalesce(t.duration_days,0),1)-1 END;
    UPDATE public.project_tasks SET
      planned_start_date=public.schedule_working_date(v_day1,v_start),
      planned_finish_date=public.schedule_working_date(v_day1,v_end)
    WHERE id=t.id;
  END LOOP;
  v_result:=jsonb_build_object('count',v_total,'warnings',v_warnings);
  INSERT INTO public.schedule_audit_log(project_id,entity,action,new_value,actor_id)
  VALUES(p_project_id,'project_schedule','recalculate_dates',v_result,u);
  RETURN v_result;
END $$;
```

### schedule_add_library_tasks

Source: `drizzle/migrations/0071_sched2a_library_task_type_cast.sql`.

```sql
CREATE OR REPLACE FUNCTION public.schedule_add_library_tasks(p_project_id uuid,p_unit_kind text,p_unit_label text,p_library_task_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u uuid:=auth.uid(); l record; t public.project_tasks%ROWTYPE;
  v_code text; v_start int; v_added int:=0; v_skipped int:=0;
BEGIN
  IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN
    RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501';
  END IF;
  IF p_unit_kind NOT IN ('module','panel_set','site') OR nullif(btrim(p_unit_label),'') IS NULL THEN
    RAISE EXCEPTION 'A valid unit kind and label are required' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p_project_id) THEN
    RAISE EXCEPTION 'Library tasks can be added only before a baseline; use schedule_add_task with a reason' USING ERRCODE='42501';
  END IF;
  FOR l IN
    SELECT lt.*,a.phase AS activity_phase FROM public.schedule_library_tasks lt
    JOIN public.schedule_library_activities a ON a.id=lt.activity_id AND a.active
    WHERE lt.id=ANY(coalesce(p_library_task_ids,ARRAY[]::uuid[])) AND lt.active
    ORDER BY lt.display_order,lt.code
  LOOP
    IF EXISTS(SELECT 1 FROM public.project_tasks WHERE project_id=p_project_id AND library_task_id=l.id AND unit_kind=p_unit_kind AND unit_label=p_unit_label) THEN
      v_skipped:=v_skipped+1; CONTINUE;
    END IF;
    v_code:=l.code||CASE WHEN p_unit_kind='module' THEN '-'||p_unit_label ELSE '' END;
    IF EXISTS(SELECT 1 FROM public.project_tasks WHERE project_id=p_project_id AND task_id_in_schedule=v_code) THEN
      RAISE EXCEPTION 'Task code % already exists in this project',v_code USING ERRCODE='22023';
    END IF;
    IF l.std_start_day IS NOT NULL THEN
      v_start:=l.std_start_day;
    ELSE
      SELECT coalesce(max(CASE WHEN start_day IS NOT NULL THEN
        CASE WHEN coalesce(duration_days,0)=0 THEN start_day ELSE start_day+greatest(coalesce(duration_days,0),1)-1 END END),0)+1
      INTO v_start FROM public.project_tasks
      WHERE project_id=p_project_id AND NOT is_removed AND unit_kind=p_unit_kind AND unit_label=p_unit_label;
    END IF;
    INSERT INTO public.project_tasks(
      project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,library_task_id,
      unit_kind,unit_label,work_category,display_order,is_qc_gate,is_payment_milestone,task_type
    ) VALUES(
      p_project_id,v_code,l.name,l.activity_phase,l.default_days,v_start,l.id,p_unit_kind,p_unit_label,
      CASE WHEN l.activity_phase='site' THEN 'construction' ELSE 'process' END,
      l.display_order,l.is_qc_gate,l.is_payment_milestone,
      (CASE WHEN l.is_qc_gate THEN 'qc_gate' WHEN l.is_payment_milestone THEN 'payment' ELSE 'task' END)::public.task_template_type
    ) RETURNING * INTO t;
    v_added:=v_added+1;
    INSERT INTO public.schedule_audit_log(project_id,task_id,entity,action,new_value,actor_id)
    VALUES(p_project_id,t.id,'project_task','add_library',to_jsonb(t),u);
  END LOOP;
  RETURN jsonb_build_object('count',v_added,'skipped',v_skipped);
END $$;
```

### schedule_repeat_for_units

Source: `drizzle/migrations/0070_sched2a_named_editors_server_dates.sql`.

```sql
CREATE OR REPLACE FUNCTION public.schedule_repeat_for_units(p_project_id uuid,p_source_unit_label text,p_target_unit_labels text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u uuid:=auth.uid(); t public.project_tasks%ROWTYPE; n public.project_tasks%ROWTYPE;
  v_kind text; v_kinds int; v_target text; v_base text; v_code text;
  v_preds text[]; v_added int:=0; v_skipped int:=0;
BEGIN
  IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN
    RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501';
  END IF;
  IF nullif(btrim(p_source_unit_label),'') IS NULL OR p_target_unit_labels IS NULL OR cardinality(p_target_unit_labels)=0 THEN
    RAISE EXCEPTION 'Source and target units are required' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p_project_id) THEN
    RAISE EXCEPTION 'Units can be repeated only before a baseline' USING ERRCODE='42501';
  END IF;
  SELECT min(unit_kind),count(DISTINCT unit_kind) INTO v_kind,v_kinds
  FROM public.project_tasks
  WHERE project_id=p_project_id AND NOT is_removed AND unit_label=p_source_unit_label AND phase='factory';
  IF v_kinds=0 THEN RAISE EXCEPTION 'Source unit has no factory tasks in this project' USING ERRCODE='22023'; END IF;
  IF v_kinds<>1 THEN RAISE EXCEPTION 'Source unit label has multiple unit kinds' USING ERRCODE='22023'; END IF;
  FOREACH v_target IN ARRAY p_target_unit_labels LOOP
    IF nullif(btrim(v_target),'') IS NULL OR v_target=p_source_unit_label THEN CONTINUE; END IF;
    FOR t IN SELECT * FROM public.project_tasks
      WHERE project_id=p_project_id AND NOT is_removed AND unit_label=p_source_unit_label AND phase='factory'
      ORDER BY display_order NULLS LAST,task_id_in_schedule,id
    LOOP
      v_base:=CASE WHEN right(t.task_id_in_schedule,length(p_source_unit_label)+1)='-'||p_source_unit_label
        THEN left(t.task_id_in_schedule,length(t.task_id_in_schedule)-length(p_source_unit_label)-1)
        ELSE t.task_id_in_schedule END;
      v_code:=v_base||'-'||v_target;
      IF EXISTS(SELECT 1 FROM public.project_tasks WHERE project_id=p_project_id AND task_id_in_schedule=v_code) THEN
        v_skipped:=v_skipped+1; CONTINUE;
      END IF;
      SELECT coalesce(array_agg(
        CASE WHEN right(pred,length(p_source_unit_label)+1)='-'||p_source_unit_label
          THEN left(pred,length(pred)-length(p_source_unit_label)-1) ELSE pred END||'-'||v_target
        ORDER BY ord),ARRAY[]::text[]) INTO v_preds
      FROM unnest(coalesce(t.predecessor_ids,ARRAY[]::text[])) WITH ORDINALITY x(pred,ord);
      INSERT INTO public.project_tasks(
        project_id,task_id_in_schedule,task_name,phase,duration_days,predecessor_ids,responsible_role,
        display_order,stage_name,parent_stage_number,library_task_id,start_day,unit_kind,unit_label,
        work_category,stage_number,input_required,output_deliverable,hstack_action,remarks,
        task_type,is_qc_gate,is_payment_milestone
      ) VALUES(
        p_project_id,v_code,t.task_name,t.phase,t.duration_days,v_preds,t.responsible_role,
        t.display_order,t.stage_name,t.parent_stage_number,t.library_task_id,t.start_day,t.unit_kind,v_target,
        t.work_category,t.stage_number,t.input_required,t.output_deliverable,t.hstack_action,t.remarks,
        t.task_type,t.is_qc_gate,t.is_payment_milestone
      ) RETURNING * INTO n;
      v_added:=v_added+1;
      INSERT INTO public.schedule_audit_log(project_id,task_id,entity,action,new_value,actor_id)
      VALUES(p_project_id,n.id,'project_task','repeat_unit',jsonb_build_object('source_unit',p_source_unit_label,'target_unit',v_target,'source_task_id',t.id,'new_task',to_jsonb(n)),u);
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('count',v_added,'skipped',v_skipped);
END $$;
```
