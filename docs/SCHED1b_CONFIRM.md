# SCHED-1b — CONFIRM

## Result and scope

Baseline additions, removals and calendar changes now require checked, reasoned writes. Removed tasks remain in history and comments, but are excluded from active task lists. The supplied task library contains **15 activities and 107 tasks**.

**Your handover answer is preserved:** `factory_supervisor` remains unable to call the helper or complete handover. Existing eligible production roles use the fixed helper; handover policies were not widened.

No schedule screen, route, navigation item, feature flag, cron, scheduled task, server reminder, account, password, role assignment or schedule-editor row was changed. Daily Report, Running Bill, Project Cost, attendance, expenses and Project Rates were not edited. Legacy uploads were not run, removed or hidden. No existing task rows were deleted or rebuilt by this delivery.

**Deployment deviation:** the foundation landed as `0067_sched1b_baseline_gaps.sql`, followed by `0068_sched1b_handover_role_source.sql` to replace a legacy profile-role helper with an authoritative `user_roles` check, and `0069_sched1b_preserve_handover_restriction.sql` to enforce your confirmed exclusion. Therefore this was **three applied migrations, not the requested single migration**. Applied history was retained rather than rewritten. The uploaded file is unchanged; its DDL ran through the migration tool and its exact data statements through the data-write tool, which does not allow seed data inside schema migrations.

## 1. INSPECT

### Venkat — email and role names only

| Email | user_roles | profiles role |
|---|---|---|
| designblr3@altree.in | head_operations | head_operations |

The authoritative join is `user_roles.user_id = profiles.auth_user_id`, not `profiles.id`. The live lookup was repeated before confirmation. No role was added to `schedule_editor_roles`; it remains exactly `planning_head`, `planning_engineer`, `head_of_projects`, `managing_director`, `super_admin`. Finance/sales/architecture directors remain excluded as schedule editors.

### Every INSERT/DELETE path

Repository search for task inserts/deletes plus database `pg_proc.prosrc` search returned:

| Path | Operation | Can execute after a baseline exists? | New outcome / handling |
|---|---|---|---|
| `MicroScheduleTab.tsx` upload, lines 304/307 | DELETE project tasks; batched INSERT parsed tasks | Yes; legacy screen has no baseline-aware guard | Database rejects with 42501. Legacy handler ignores these errors and can still record upload metadata/show success; deliberately not changed. |
| `ProjectSetupUpload.tsx`, lines 813/816 | DELETE project tasks; batched INSERT | Yes | Database rejects with 42501; handler checks deletion/insertion errors. No upload was run. |
| `FactoryFloorMap.tsx`, former direct INSERT near line 387 | Fixed Collect panels helper task | Yes | Replaced only this insert with `create_panel_handover_task(batch.id)`. Errors abort with a visible message instead of continuing without the helper. Final eligible roles exclude factory_supervisor. |
| `commit_project_setup_upload(uuid,jsonb,jsonb,jsonb)` | INSERT missing task codes; UPDATE matching names/planned dates/responsible role; no DELETE | Yes | Baseline membership/details guards reject the write. Checked upload transaction rolls back. No upload screen or RPC was rewritten. |
| `clone_task_templates_to_project(uuid,text)` | DELETE all tasks then INSERT template tasks | Yes, from production-system change; also callable as its existing function | The new trigger rejects the deletion even in definer context. Impersonated fixture confirmed 42501 and retained the original task. Consequently an attempted production-system change which re-clones a published schedule fails rather than destroying it. |
| projects AFTER INSERT / UPDATE OF production_system trigger | Calls the clone function above | INSERT creates a new, unbaselined project; UPDATE may be on a published project | New-project behaviour is unchanged; published-system re-clone is blocked. |
| `trg_project_closure_create_archive()` | INSERT archive follow-up task | Yes, on project closure | No exemption was introduced: its task insert is blocked on a published project. This can roll back closure; see limitations. |
| `trg_project_closure_amc_followup()` | INSERT AMC follow-up task | Yes, on project closure | Same post-baseline guard; no reminder or closure function rewritten. |
| New `schedule_add_task(uuid,jsonb,text)` | INSERT whitelisted schedule task | Requires an existing baseline | Checked editor + project access + nonblank reason; audited. Task stays baseline_version=NULL until next publish. |
| New `create_panel_handover_task(uuid)` | INSERT one fixed operational helper | Yes | Checked existing eligible factory roles + batch project/module ownership; no caller-selected task text/dates/category. Actor, fixed reason and batch/module link audited; retry is idempotent. |

`TaskUpdateSheet` writes actual progress/dates/status/remarks/delay fields and `project_subtasks`, not task membership. `TaskMasterTab` updates responsible_role, not membership. `kpi-recompute` and `ai-agents` only read project_tasks. Daily Report paths write actuals, not INSERT/DELETE; they were not changed.

## 2. SQL and file evidence

The exact applied foundation SQL and final helper definition are reproduced below. The unchanged SCHED-1 INSERT/DELETE policies remain editor-only; UPDATE RLS was not altered. New RPC EXECUTE grants are authenticated-only, with caller-bound checks inside; there are no new broad table grants.

### Active-list files changed for is_removed

Only `.eq("is_removed", false)` was added to existing task readers in:

- `src/components/projects/MicroScheduleTab.tsx`
- `src/components/tasks/MyTasksSection.tsx` (both reads)
- `src/components/tasks/MyTasksSummaryStrip.tsx`
- `src/components/production/StageChecklistDrawer.tsx`
- `src/components/production/ModuleSchedule.tsx`
- `src/components/dispatch/DispatchPackFormV2.tsx`
- `src/components/dispatch/InstallationSequenceV2.tsx`
- `src/components/site/InstallationSequenceDoc.tsx`
- `src/pages/ProductionDashboard.tsx`
- `src/pages/Management.tsx`
- `src/components/dashboard/DailyReadinessBrief.tsx` (display queries only; no cutoff, reminder, notification or scheduling change)

TaskUpdateSheet gets its task lists from filtered parents and was not modified. Historical/financial readers and the explicitly excluded modules remain unchanged. `FactoryFloorMap.tsx` has only the requested checked-helper call replacement and error handling.

### Unchanged editor policies

```sql
CREATE POLICY "Schedule editors can insert project tasks"
ON public.project_tasks FOR INSERT TO authenticated
WITH CHECK (public.can_edit_schedule(auth.uid()));
CREATE POLICY "Schedule editors can delete project tasks"
ON public.project_tasks FOR DELETE TO authenticated
USING (public.can_edit_schedule(auth.uid()));
```

## 3. Real-principal rollback tests

Tests used existing active accounts, `SET LOCAL ROLE authenticated`, and transaction-local caller claims; no roles/accounts were created or edited. The Test project received temporary team membership and fixture rows only inside rollback blocks. Each negative test asserted its actual SQLSTATE; unexpected success fails the test. The final intentional P0001 returns the evidence and rolls back **all** fixture changes—it is not an application error.

The site/factory principal already has both site_engineer and factory_supervisor; tests assert that it is not a schedule editor. A separate existing production_head principal exercises the permitted handover action.

| Required test | Observed evidence |
|---|---|
| (a) Draft planning INSERT / DELETE | INSERT succeeded; DELETE affected 1 row. |
| (b) Published direct INSERT / DELETE | Both rejected with **42501**, including planning_engineer. |
| (b) Add task | Blank reason **22023**; reasoned add succeeded with baseline_version NULL. |
| (b) Remove task | Blank reason **22023**; reasoned removal retained row with is_removed=true, actor/time/reason, comment and audit. |
| Extra protection | Direct edit of the pending task rejected **42501**; spoofed client bypass context rejected **42501**. |
| (c) site_engineer add/remove RPCs | Both **42501**. |
| (d) Holiday INSERT / is_active toggle | Direct writes **42501** after baseline; blank checked reason **22023**; checked add/deactivation succeeded and produced two actor/reason audit rows. Stored planned_start_date stayed unchanged. |
| (e) factory_supervisor | **Blocked as you confirmed:** helper and arbitrary task INSERT both **42501**. No handover policy widened. |
| (e) Existing production_head | Fixed helper payload, audit and retry idempotence passed; handover was linked to helper and read back; batch status handing_over read back; arbitrary task INSERT still **42501**. |
| (f) Library | **15 activities / 107 tasks**, no duplicate codes. Activity 13 site, all other activities factory. Activities 14/15 have NULL standard days. |
| (f) Re-run supplied seed data | Data statements re-run unchanged; counts remained **15 / 107**, so zero new records. The DDL was already applied via migration. |
| (g) Version 2 | Added task present with baseline_version=2; removed task present with is_removed=true and removal reason/actor/time. Live rows stamped version 2 only by publish. |
| Additional clone regression | SECURITY DEFINER clone attempt returned **42501**; baseline task remained. |

Retained tests: `src/test/sched1b-foundation.rollback.sql` and `src/test/sched1b-handover.rollback.sql`. The final helper restriction was tested separately after your answer, replacing the earlier provisional helper-access result. After rollback, queries found zero test task codes, test baseline versions, test holidays or test reason audit rows; the library seed intentionally remains.

## 4. Automated tests

**66 files, 955 tests passed, 0 failed, 0 skipped** (`bunx vitest run --maxWorkers=2 --minWorkers=1`). The unrestricted final run hit four 5-second timeouts; rerunning with two workers passed the full suite without changing tests or timeout settings. Final preview compilation: build OK (26/11/2026 11:45:55 UTC). No scan findings were bulk-fixed or suppressed; no clean security-scan claim is made.

## 5. Limitations / behaviour to be aware of

- `factory_supervisor` completion is deliberately blocked under your answer. No active factory_floor_supervisor account was found; a real existing production_head exercised the permitted database handover path instead.
- No physical panel move or authenticated FactoryFloorMap browser click was performed; database creation, linkage, status update and readback were verified in rollback fixtures.
- Legacy MicroSchedule upload can misleadingly report success because it ignores task-write errors; its existing UI was preserved as requested. Workbook/setup uploads and system re-cloning cannot overwrite a published baseline.
- Existing closure/archive/AMC triggers insert project_tasks, so a published project's closure can be blocked by the required membership guard. These functions/reminders were not exempted or rewritten; a complete closure flow was not verified. A later scoped revision-aware closure change would be needed to retain automatic closure tasks.
- Historical readers and excluded reporting modules keep their existing access to archived task history. Capacity/alert/cron calculations were not rewritten in this database-focused batch; this is not a claim that every existing analytics/reminder reader now excludes removed history.
- Schema and seed data are already live in the shared database; **Publish > Update** is needed to deploy the checked handover call and active-list filters. Review the upload/closure caveats above before publishing. No new schedule editor screen exists in this batch.

## Exact applied foundation SQL (0067)

```sql
ALTER TABLE public.project_tasks ADD COLUMN is_removed boolean NOT NULL DEFAULT false, ADD COLUMN removed_at timestamptz, ADD COLUMN removed_by uuid, ADD COLUMN removed_reason text;
ALTER TABLE public.schedule_library_tasks ADD COLUMN IF NOT EXISTS std_start_day int, ADD COLUMN IF NOT EXISTS source_flag text, ADD COLUMN IF NOT EXISTS source_steps text;

-- The bypass is accepted only inside owner-executed checked functions, never from a client role.
CREATE OR REPLACE FUNCTION public.schedule_task_membership_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p uuid; mode text := coalesce(current_setting('hstack.schedule_membership',true),''); trusted boolean := current_user = pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.schedule_add_task(uuid,jsonb,text)'::regprocedure));
BEGIN
 p := CASE WHEN TG_OP='DELETE' THEN OLD.project_id ELSE NEW.project_id END;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p::text));
 IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p) THEN
   IF TG_OP='DELETE' OR NOT (trusted AND mode IN ('add','handover')) THEN
     RAISE EXCEPTION 'Published schedule membership requires a reasoned revision; tasks must be archived, not deleted' USING ERRCODE='42501';
   END IF;
 END IF;
 IF TG_OP='INSERT' THEN
   NEW.baseline_version := NULL;
   NEW.is_removed := false; NEW.removed_at := NULL; NEW.removed_by := NULL; NEW.removed_reason := NULL;
   RETURN NEW;
 END IF;
 RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.project_tasks_baseline_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_revise boolean := coalesce(current_setting('hstack.schedule_revise',true),'')='on' AND current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.publish_schedule_baseline(uuid,text)'::regprocedure));
BEGIN
 IF TG_OP='INSERT' THEN NEW.baseline_version:=NULL; RETURN NEW; END IF;
 IF NEW.baseline_version IS DISTINCT FROM OLD.baseline_version AND NOT v_revise THEN RAISE EXCEPTION 'Baseline version is set only by publishing a baseline' USING ERRCODE='42501'; END IF;
 IF (NEW.is_removed,NEW.removed_at,NEW.removed_by,NEW.removed_reason) IS DISTINCT FROM (OLD.is_removed,OLD.removed_at,OLD.removed_by,OLD.removed_reason) AND NOT v_revise THEN
   RAISE EXCEPTION 'Removal requires schedule_remove_task and a reason' USING ERRCODE='42501';
 END IF;
 IF (NEW.project_id,NEW.task_name,NEW.duration_days,NEW.planned_start_date,NEW.planned_finish_date,NEW.predecessor_ids,NEW.display_order,NEW.phase,NEW.stage_name,NEW.parent_task_id,NEW.parent_stage_number,NEW.responsible_role,NEW.library_task_id,NEW.start_day,NEW.unit_kind,NEW.unit_label,NEW.task_id_in_schedule,NEW.work_category,NEW.stage_number)
 IS DISTINCT FROM (OLD.project_id,OLD.task_name,OLD.duration_days,OLD.planned_start_date,OLD.planned_finish_date,OLD.predecessor_ids,OLD.display_order,OLD.phase,OLD.stage_name,OLD.parent_task_id,OLD.parent_stage_number,OLD.responsible_role,OLD.library_task_id,OLD.start_day,OLD.unit_kind,OLD.unit_label,OLD.task_id_in_schedule,OLD.work_category,OLD.stage_number) THEN
   IF v_revise THEN RETURN NEW; END IF;
   PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
   PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||OLD.project_id::text));
   IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id IN (OLD.project_id,NEW.project_id)) THEN
     RAISE EXCEPTION 'Published schedule details require a revision and reason, including pending tasks' USING ERRCODE='42501';
   END IF;
   IF current_user IN ('authenticated','anon') AND NOT public.can_edit_schedule(auth.uid()) THEN RAISE EXCEPTION 'Only schedule editors may change task details' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_add_task(p_project_id uuid,p_task jsonb,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); t public.project_tasks%ROWTYPE; r text:=nullif(btrim(p_reason),''); bad text; prior text:=coalesce(current_setting('hstack.schedule_membership',true),'');
BEGIN
 IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501'; END IF;
 IF r IS NULL THEN RAISE EXCEPTION 'A reason is required to add a schedule task' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
 IF NOT EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p_project_id) THEN RAISE EXCEPTION 'Publish a baseline before adding a revision task' USING ERRCODE='22023'; END IF;
 IF p_task IS NULL OR jsonb_typeof(p_task)<>'object' THEN RAISE EXCEPTION 'Task must be an object' USING ERRCODE='22023'; END IF;
 SELECT k INTO bad FROM jsonb_object_keys(p_task) k WHERE k<>ALL(ARRAY['task_id_in_schedule','task_name','phase','duration_days','planned_start_date','planned_finish_date','predecessor_ids','display_order','stage_name','parent_task_id','parent_stage_number','responsible_role','library_task_id','start_day','unit_kind','unit_label','work_category','stage_number']) LIMIT 1;
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Field % cannot be supplied',bad USING ERRCODE='22023'; END IF;
 IF nullif(btrim(p_task->>'task_name'),'') IS NULL OR nullif(btrim(p_task->>'task_id_in_schedule'),'') IS NULL THEN RAISE EXCEPTION 'Task code and name are required' USING ERRCODE='22023'; END IF;
 IF coalesce((p_task->>'duration_days')::int,0)<0 THEN RAISE EXCEPTION 'Duration cannot be negative' USING ERRCODE='22023'; END IF;
 IF p_task ? 'parent_task_id' AND NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=(p_task->>'parent_task_id')::uuid AND project_id=p_project_id AND NOT is_removed) THEN RAISE EXCEPTION 'Parent task must belong to this project' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM project_tasks WHERE project_id=p_project_id AND task_id_in_schedule=p_task->>'task_id_in_schedule' AND NOT is_removed) THEN RAISE EXCEPTION 'Task code already exists' USING ERRCODE='22023'; END IF;
 PERFORM set_config('hstack.schedule_membership','add',true);
 INSERT INTO public.project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,planned_start_date,planned_finish_date,predecessor_ids,display_order,stage_name,parent_task_id,parent_stage_number,responsible_role,library_task_id,start_day,unit_kind,unit_label,work_category,stage_number)
 VALUES(p_project_id,p_task->>'task_id_in_schedule',p_task->>'task_name',coalesce(p_task->>'phase','Pre-Production'),coalesce((p_task->>'duration_days')::int,0),(p_task->>'planned_start_date')::date,(p_task->>'planned_finish_date')::date,ARRAY(SELECT jsonb_array_elements_text(coalesce(p_task->'predecessor_ids','[]'::jsonb))),(p_task->>'display_order')::int,p_task->>'stage_name',(p_task->>'parent_task_id')::uuid,p_task->>'parent_stage_number',p_task->>'responsible_role',(p_task->>'library_task_id')::uuid,(p_task->>'start_day')::int,p_task->>'unit_kind',p_task->>'unit_label',coalesce(p_task->>'work_category','process'),p_task->>'stage_number') RETURNING * INTO t;
 PERFORM set_config('hstack.schedule_membership',prior,true);
 INSERT INTO schedule_audit_log(project_id,task_id,entity,action,reason,new_value,actor_id) VALUES(p_project_id,t.id,'project_task','add',r,to_jsonb(t),u);
 RETURN t.id;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_remove_task(p_task_id uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); t public.project_tasks%ROWTYPE; n public.project_tasks%ROWTYPE; r text:=nullif(btrim(p_reason),''); prior text:=coalesce(current_setting('hstack.schedule_revise',true),'');
BEGIN
 SELECT * INTO t FROM project_tasks WHERE id=p_task_id;
 IF t.id IS NULL OR u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,t.project_id) THEN RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501'; END IF;
 IF r IS NULL THEN RAISE EXCEPTION 'A reason is required to remove a schedule task' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||t.project_id::text));
 SELECT * INTO t FROM project_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM schedule_baselines WHERE project_id=t.project_id) THEN RAISE EXCEPTION 'Publish a baseline before removing a revision task' USING ERRCODE='22023'; END IF;
 IF t.is_removed THEN RAISE EXCEPTION 'Task is already removed' USING ERRCODE='22023'; END IF;
 PERFORM set_config('hstack.schedule_revise','on',true);
 UPDATE project_tasks SET is_removed=true,removed_at=now(),removed_by=u,removed_reason=r,updated_at=now() WHERE id=p_task_id RETURNING * INTO n;
 PERFORM set_config('hstack.schedule_revise',prior,true);
 INSERT INTO schedule_audit_log(project_id,task_id,entity,action,reason,old_value,new_value,actor_id) VALUES(t.project_id,t.id,'project_task','remove',r,to_jsonb(t),to_jsonb(n),u);
 RETURN t.id;
END $$;
CREATE TRIGGER trg_schedule_task_membership BEFORE INSERT OR DELETE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.schedule_task_membership_guard();

CREATE OR REPLACE FUNCTION public.schedule_holiday_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 IF EXISTS(SELECT 1 FROM public.schedule_baselines) AND NOT (coalesce(current_setting('hstack.schedule_holiday',true),'')='on' AND current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.schedule_change_holiday(date,text,boolean,text)'::regprocedure))) THEN
   RAISE EXCEPTION 'Holiday changes after publication require a reasoned calendar revision' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.schedule_change_holiday(p_date date,p_label text,p_active boolean,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); r text:=nullif(btrim(p_reason),''); old_h jsonb; new_h jsonb; prior text:=coalesce(current_setting('hstack.schedule_holiday',true),'');
BEGIN
 IF u IS NULL OR NOT public.can_edit_schedule(u) THEN RAISE EXCEPTION 'Schedule editor required' USING ERRCODE='42501'; END IF;
 IF r IS NULL THEN RAISE EXCEPTION 'A reason is required to change a holiday' USING ERRCODE='22023'; END IF;
 IF p_date IS NULL OR p_active IS NULL OR nullif(btrim(p_label),'') IS NULL THEN RAISE EXCEPTION 'Holiday date, label and active state are required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 SELECT to_jsonb(h) INTO old_h FROM schedule_holidays h WHERE holiday_date=p_date FOR UPDATE;
 PERFORM set_config('hstack.schedule_holiday','on',true);
 INSERT INTO schedule_holidays(holiday_date,label,is_active,created_by,updated_by) VALUES(p_date,p_label,p_active,u,u)
 ON CONFLICT(holiday_date) DO UPDATE SET label=excluded.label,is_active=excluded.is_active,updated_by=u,updated_at=now() RETURNING to_jsonb(schedule_holidays.*) INTO new_h;
 PERFORM set_config('hstack.schedule_holiday',prior,true);
 INSERT INTO schedule_audit_log(entity,action,reason,old_value,new_value,actor_id) VALUES('schedule_holiday','change',r,old_h,new_h,u);
 RETURN new_h;
END $$;
CREATE TRIGGER trg_schedule_holiday_guard BEFORE INSERT OR UPDATE ON public.schedule_holidays FOR EACH ROW EXECUTE FUNCTION public.schedule_holiday_guard();

CREATE OR REPLACE FUNCTION public.publish_schedule_baseline(p_project_id uuid,p_reason text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); v int; snap jsonb; r text:=nullif(btrim(p_reason),''); prior text:=coalesce(current_setting('hstack.schedule_revise',true),'');
BEGIN
 IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
 PERFORM 1 FROM project_tasks WHERE project_id=p_project_id FOR UPDATE;
 SELECT coalesce(max(version),0)+1 INTO v FROM schedule_baselines WHERE project_id=p_project_id;
 IF v>1 AND r IS NULL THEN RAISE EXCEPTION 'A reason is required to publish revision %',v USING ERRCODE='22023'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',t.id,'task_id_in_schedule',t.task_id_in_schedule,'task_name',t.task_name,'duration_days',t.duration_days,'planned_start_date',t.planned_start_date,'planned_finish_date',t.planned_finish_date,'predecessor_ids',t.predecessor_ids,'display_order',t.display_order,'phase',t.phase,'stage_name',t.stage_name,'parent_task_id',t.parent_task_id,'parent_stage_number',t.parent_stage_number,'responsible_role',t.responsible_role,'library_task_id',t.library_task_id,'start_day',t.start_day,'unit_kind',t.unit_kind,'unit_label',t.unit_label,'is_removed',t.is_removed,'removed_at',t.removed_at,'removed_by',t.removed_by,'removed_reason',t.removed_reason,'baseline_version',v) ORDER BY t.display_order NULLS LAST,t.task_id_in_schedule,t.id) INTO snap FROM project_tasks t WHERE project_id=p_project_id;
 IF snap IS NULL THEN RAISE EXCEPTION 'No schedule tasks to publish' USING ERRCODE='22023'; END IF;
 INSERT INTO schedule_baselines(project_id,version,kind,reason,published_by,snapshot) VALUES(p_project_id,v,CASE WHEN v=1 THEN 'baseline' ELSE 'revision' END,r,u,snap);
 PERFORM set_config('hstack.schedule_revise','on',true);
 UPDATE project_tasks SET baseline_version=v WHERE project_id=p_project_id;
 PERFORM set_config('hstack.schedule_revise',prior,true);
 INSERT INTO schedule_audit_log(project_id,entity,action,reason,new_value,actor_id) VALUES(p_project_id,'schedule_baseline','publish',r,jsonb_build_object('version',v,'task_count',jsonb_array_length(snap)),u);
 RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.schedule_add_task(uuid,jsonb,text),public.schedule_remove_task(uuid,text),public.schedule_change_holiday(date,text,boolean,text),public.create_panel_handover_task(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.schedule_add_task(uuid,jsonb,text),public.schedule_remove_task(uuid,text),public.schedule_change_holiday(date,text,boolean,text),public.create_panel_handover_task(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.schedule_task_membership_guard(),public.schedule_holiday_guard() FROM PUBLIC,anon,authenticated;

```

## Exact final helper SQL (0069 supersedes 0067/0068 helper)

```sql
CREATE OR REPLACE FUNCTION public.create_panel_handover_task(p_batch_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); b public.panel_batches%ROWTYPE; m uuid; mp uuid; tid uuid; prior text:=coalesce(current_setting('hstack.schedule_membership',true),'');
BEGIN
 IF u IS NULL OR NOT public.is_active_staff(u) OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role IN ('factory_floor_supervisor','production_head','managing_director','finance_director','sales_director','architecture_director','super_admin')) THEN RAISE EXCEPTION 'Factory handover access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM panel_batches WHERE id=p_batch_id FOR UPDATE;
 IF b.id IS NULL OR b.project_id IS NULL OR NOT public.user_can_access_project(u,b.project_id) THEN RAISE EXCEPTION 'Panel batch project access required' USING ERRCODE='42501'; END IF;
 IF b.bay_assignment_id IS NOT NULL THEN
   SELECT a.module_id,mo.project_id INTO m,mp FROM bay_assignments a JOIN modules mo ON mo.id=a.module_id WHERE a.id=b.bay_assignment_id AND NOT coalesce(mo.is_archived,false);
   IF m IS NULL OR mp IS DISTINCT FROM b.project_id OR NOT public.user_can_access_project(u,mp) THEN RAISE EXCEPTION 'Module must belong to the accessible batch project' USING ERRCODE='42501'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||b.project_id::text));
 SELECT id INTO tid FROM project_tasks WHERE project_id=b.project_id AND task_id_in_schedule='PHO-'||b.id::text AND NOT is_removed;
 IF tid IS NOT NULL THEN RETURN tid; END IF;
 PERFORM set_config('hstack.schedule_membership','handover',true);
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,work_category,responsible_role,status)
 VALUES(b.project_id,'PHO-'||b.id::text,'Collect panels','Production','process','factory_floor_supervisor','Upcoming') RETURNING id INTO tid;
 PERFORM set_config('hstack.schedule_membership',prior,true);
 INSERT INTO schedule_audit_log(project_id,task_id,entity,action,reason,new_value,actor_id) VALUES(b.project_id,tid,'project_task','handover_helper','Panel batch marked ready for module handover',jsonb_build_object('panel_batch_id',b.id,'module_id',m,'task_name','Collect panels','phase','Production','work_category','process'),u);
 RETURN tid;
END $$;
```
