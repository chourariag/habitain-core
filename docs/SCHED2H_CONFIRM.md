# SCHED-2h CONFIRM

## Result and publishing
Site engineers can save only the seven requested actuals fields on ordinary site-role tasks in projects they can access. TaskUpdateSheet checks returned errors and zero-row RLS refusals, keeps the sheet open, and never reports success or records a benchmark on refused task saves. **Publish > Update now** to ship the screen changes; migration 0078 is already live.

## 1. INSPECT: existing UPDATE rights and role sources
Before this change project_tasks had one permissive UPDATE policy, `Planning/production/ops can update project tasks`, using `user_has_any_role(auth.uid(), roles)` for super_admin, managing_director, chairman, head_operations, production_head, planning_head, planning_engineer, site_installation_mgr, factory_floor_supervisor, factory_supervisor, finance_director, sales_director, architecture_director. It has no column-specific restriction and no explicit WITH CHECK (PostgreSQL uses USING as the implicit check). **The policy is unchanged.**

`user_has_any_role`, `get_user_role` and `has_role` currently read active `profiles.role`, not user_roles. The new policy/trigger deliberately use `get_user_role` to match the requested screen role. Vincent (prod.dbr5@altree.in) has profile site_engineer, with user_roles site_engineer + factory_supervisor; no mismatch or account was changed. The other active profile-site engineer is prod.dbr6@altree.in. Nazim's profile is site_installation_mgr, so Vincent was used for the engineer proof. `user_can_access_project` resolves existing admin/director entitlement or active project_team_members joined through profiles.auth_user_id.

Existing triggers:
- `trg_project_tasks_baseline_guard` BEFORE INSERT/UPDATE: baseline version and removal metadata are privileged; schedule details require a checked revision after publication and an editor before publication. Actuals are outside its protected detail tuple and remain allowed. Its checked revision exception uses both the internal setting and function-owner identity. Unchanged.
- `trg_schedule_task_membership` BEFORE INSERT/DELETE: protects baselined membership and closure follow-ups. Unchanged.
- `update_project_tasks_updated_at` BEFORE UPDATE: fills updated_at. Unchanged.
- `trg_archive_task_completed` AFTER UPDATE OF status: on transition to Completed (except pre-HStack completion), looks for project_archives.karthik_upload_task_id; if matched, confirms archive upload, enables cleanup eligibility, and notifies head_of_projects/Tier 1 directors via user_roles. Ordinary site tasks do not match this archive task (archive task is planning_engineer). Unchanged.

The new guard sorts before existing BEFORE triggers and compares the full NEW/OLD JSON minus **only seven columns**; updated_at cannot be supplied by the caller, but the existing later trigger still sets it. Future columns are denied by default. A progress audit row stores old/new actuals/status, actor from auth.uid(), and server time.

## 2. INSPECT: completion effects
- TaskUpdateSheet Start/Save/Complete write project_tasks actuals only. At 100% it calls recordTaskBenchmark **only after a successful save**, and only if actual start/finish exist. Existing task_benchmarks INSERT policy excludes site_engineer, so that existing best-effort call cannot create a site-engineer benchmark. No benchmark permission was widened.
- StageChecklistDrawer's payment notification is an explicit separate checklist action, not a task UPDATE trigger. QC request is another explicit action updating qc_requested_at/status and notifying inspectors. This change does not expose those actions, and site engineers cannot update QC/payment rows or qc_requested_at.
- Stage checklist completion/readiness and Home/Actuals/production progress displays consume task status/percent. Successful site actuals naturally change those read-only rollups; this sheet does not directly transition project_stages or module stages. QC gates remain independent.
- The archive completion trigger above is the sole existing task-completion database trigger. There is no task UPDATE trigger that releases payment or completes QC.
- Existing report/readiness/benchmark/KPI consumers can read changed task progress; no report writer, scheduled function, notification schedule, or calendar logic was modified. Client milestone computation uses stage status, not a new direct payment write from this sheet.

## 3. SQL: new policy and trigger (exact migration)
```sql
CREATE POLICY "Site engineers can update own site task actuals"
ON public.project_tasks FOR UPDATE TO authenticated
USING (
 public.get_user_role(auth.uid()) = 'site_engineer'::public.app_role
 AND is_removed = false
 AND responsible_role IN ('site_installation_mgr','site_engineer')
 AND task_type = 'task'::public.task_template_type
 AND is_qc_gate = false AND is_payment_milestone = false
 AND public.user_can_access_project(auth.uid(), project_id)
)
WITH CHECK (
 public.get_user_role(auth.uid()) = 'site_engineer'::public.app_role
 AND is_removed = false
 AND responsible_role IN ('site_installation_mgr','site_engineer')
 AND task_type = 'task'::public.task_template_type
 AND is_qc_gate = false AND is_payment_milestone = false
 AND public.user_can_access_project(auth.uid(), project_id)
);

CREATE FUNCTION public.site_engineer_task_actuals_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
 allowed text[] := ARRAY['completion_percentage','status','actual_start_date','actual_finish_date','remarks','delay_cause','delay_resolution'];
BEGIN
 IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'site_engineer'::public.app_role THEN RETURN NEW; END IF;
 IF OLD.is_removed OR OLD.responsible_role IS NULL
 OR OLD.responsible_role NOT IN ('site_installation_mgr','site_engineer')
 OR OLD.task_type <> 'task'::public.task_template_type
 OR OLD.is_qc_gate OR OLD.is_payment_milestone
 OR NOT public.user_can_access_project(auth.uid(), OLD.project_id) THEN
  RAISE EXCEPTION 'You can update progress only on ordinary site tasks in projects you can access' USING ERRCODE='42501';
 END IF;
 -- Runs before all other BEFORE UPDATE triggers. Compare the complete row,
 -- excluding only the seven permitted fields: future columns are denied by default.
 IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
  RAISE EXCEPTION 'Site engineers can update progress, actual dates and notes only; schedule and other task fields cannot be changed' USING ERRCODE='42501';
 END IF;
 IF (to_jsonb(NEW) - (SELECT array_agg(key) FROM jsonb_object_keys(to_jsonb(NEW)) key WHERE NOT key = ANY(allowed)))
 IS DISTINCT FROM (to_jsonb(OLD) - (SELECT array_agg(key) FROM jsonb_object_keys(to_jsonb(OLD)) key WHERE NOT key = ANY(allowed))) THEN
  INSERT INTO public.schedule_audit_log(project_id, task_id, entity, action, old_value, new_value, actor_id)
  VALUES (OLD.project_id, OLD.id, 'task', 'site_actuals_update',
   jsonb_build_object('completion_percentage',OLD.completion_percentage,'status',OLD.status,'actual_start_date',OLD.actual_start_date,'actual_finish_date',OLD.actual_finish_date,'remarks',OLD.remarks,'delay_cause',OLD.delay_cause,'delay_resolution',OLD.delay_resolution),
   jsonb_build_object('completion_percentage',NEW.completion_percentage,'status',NEW.status,'actual_start_date',NEW.actual_start_date,'actual_finish_date',NEW.actual_finish_date,'remarks',NEW.remarks,'delay_cause',NEW.delay_cause,'delay_resolution',NEW.delay_resolution), auth.uid());
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.site_engineer_task_actuals_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER aaa_site_engineer_task_actuals_guard BEFORE UPDATE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.site_engineer_task_actuals_guard();
```

## 4. Real-account rollback matrix on Test project - 1
Saved harness: src/test/sched2h-site-actuals.rollback.sql. Executed with actual existing principal IDs and SET LOCAL ROLE authenticated under RLS, not a service-role-only write. An intentional final exception rolls back the complete transaction.

Test setup only: temporarily added project access for Vincent and Azad and used Azad's existing reasoned revision to give F01-TEST-M1 responsible_role=site_installation_mgr. No account/role/profile was edited, no baseline published. Existing baseline v2 was used.

| Requested check | Result |
|---|---|
| (a) Vincent 40% + actual start + status/notes | 1 row, success; audit attributed to Vincent |
| (b) Duration, planned start, planned finish, predecessors, responsible role, task name | Every changed field refused 42501 |
| Additional protected fields | updated_at, payment flag, unit_label refused 42501; 9 denials total |
| (c) Same Vincent on factory task | RLS filtered row: 0 updated, no error from PostgreSQL |
| (d) QC flag, payment flag, qc_gate type, payment type, removed row | Each filtered: 0 updated |
| (e) Existing prod.dbr6 site engineer without project access | 0 updated |
| (f) After existing baseline v2 | Save succeeded; full non-actuals row comparison unchanged (apart from server updated_at) |
| (g) Azad production_head factory actuals | 1 row, success as before |
| Actual finish / Complete | 100%, Completed, finish and delay fields succeeded |
| (h) UI failure | Browser + automated tests below |

**Important distinction:** protected-column changes on an eligible row produce 42501; ineligible rows (factory/QC/payment/no-access) are silently filtered by PostgreSQL RLS. The screen now detects the missing returned row and shows refusal instead of false success.

Post-rollback readback: versions [1,2] remain; no sched2h_test team rows, no site_actuals_update audit rows, F01 remains factory_supervisor with 0% and no actual dates. No fixtures remain.

## 5. Screen checks and screenshots
Used Gaurav's real signed-in Home, verified his account, then existing **View As Site Engineer**. There are currently **no active scheduled/started site-role rows**, so the screenshots use a mocked task read and a mocked 42501 PATCH reply matching the new database message. The browser sent no live task mutation. This is screen-state evidence, not a real engineer end-to-end successful save.

- 390px: opened sheet, 40% progress and notes controls visible; no Add subtask; planned details display-only.
- Refused Save Progress: inline database message visible, error toast, sheet stays open, Save remains available, no success toast. PATCH contained exactly completion_percentage, remarks, delay_cause, delay_resolution.
- Real browser resized to 1440px: refused sheet remained readable; page scrollWidth exactly 390/1440 at respective sizes.
- Screenshots: /mnt/documents/sched2h/sheet390.png, refused390.png, refused1440.png.

Site-engineer subtask toggling is disabled, creation stays false, and sheet task writer accepts only the seven actuals fields. Other roles retain existing subtask controls. Legacy subtask actor/timestamp payloads were not changed; the site-engineer path cannot invoke them.

## 6. Automated tests and changed files
**984 passing tests, 72 files, no failed/skipped tests**. Six new tests cover role eligibility, database error/zero-row handling, exact 40% payload without actors/schedule fields, and Start/progress/100% refusals (no success/close/benchmark). Existing sheet tests emit the pre-existing missing dialog description warning; no runtime crash observed. Preview build log: build OK.

Changed: migration 0078 and tool-generated journal/snapshot; src/lib/task-progress-save.ts; src/lib/my-tasks-roles.ts; HomeMyTasks.tsx; MyTasksSection.tsx; TaskUpdateSheet.tsx; two new test files; roadmap.md; this report. No earlier migration edited. Root AGENTS.md had no space for an additional architecture rule and was left unchanged.

## 7. Not verified / operational constraints
- No real engineer browser successful save/readback: no eligible scheduled site task exists, and eligible principals currently have **no access to Test project - 1**. Access was temporary only inside rollback tests. An authorized existing project-team assignment and an ordinary scheduled site-role task are required for a real engineer to save on that project; this request did not change those records.
- Screenshots are View As with mocked task and refusal, not Vincent's sign-in. No accounts/passwords changed.
- Start and Complete refusal behavior is covered by component tests; browser captured Save Progress refusal only. Completion uses the existing Save Progress at 100% path; the existing dedicated Complete visibility condition was not redesigned.
- No live payment/QC notification or stage transition was executed; inspected call sites/triggers and tested row denials instead.
- No schedule/date/browser calculation, baseline function, Daily Report, Running Bill, Project Cost, attendance, expense, BOQ, Project Rates, role/account/flag/cron was changed.
