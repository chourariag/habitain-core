# SCHED-1 — Schedule foundation (database + permissions only)

Migration: `drizzle/migrations/0066_sched1_schedule_foundation.sql`. No screens, routes, navigation, flags, cron, roles, accounts or passwords changed. No existing project_tasks rows changed; ProjectSetupUpload not run.

## 1. INSPECT

### project_tasks writers
Baseline columns guarded: project_id, task_name, duration_days, planned_start_date, planned_finish_date, predecessor_ids, display_order, phase, stage_name, parent_task_id, parent_stage_number, responsible_role, + new library_task_id, start_day, unit_kind, unit_label, baseline_version (set only by publish).
Actual columns (open to existing UPDATE-policy roles): completion_percentage, actual_start/finish_date, status, remarks, is_locked, lock_override_*, delay_*, backfill_*, qc_*, escalated_at, completion_type, special_note, etc.

| Writer | Op | Columns | Impact under SCHED-1 |
|---|---|---|---|
| TaskMasterTab (Super Admin "apply to active") | UPDATE | responsible_role (baseline) | Super Admin is an editor → works on un-baselined rows; on baselined rows the update is rejected (loop ignores errors silently). Use schedule_revise_task later. |
| MicroScheduleTab upload | DELETE all + INSERT | all baseline cols | Now editors only (was 9–13 roles). Legacy screen unchanged. |
| MicroScheduleTab start / lock override | UPDATE | status, actual_start_date, completion_percentage, is_locked, lock_override_* | Actual only → unaffected. |
| ProjectSetupUpload | DELETE all + INSERT | all baseline cols | Now editors only. Not run. |
| commit_project_setup_upload (Workbook RPC, SECURITY DEFINER, own planning gate) | UPDATE/INSERT | task_name, planned_*, responsible_role, work_category | Definer context allowed on un-baselined rows; rejected (42501) on baselined rows by design. |
| TaskUpdateSheet | UPDATE | actual_*, status, completion_percentage, remarks, delay_* | Unaffected. |
| MyTasksSection, DispatchPackFormV2, InstallationSequenceV2, ModuleSchedule, InstallationSequenceDoc | read only | – | – |
| StageChecklistDrawer | UPDATE | status, completion_percentage, actual_finish_date, qc_requested_at | Unaffected. |
| FactoryFloorMap handover | INSERT (collect-panels task) + UPDATE actuals | task_name, phase, planned_*, responsible_role… | **INSERT now fails for non-editor factory roles.** Code does not check the error: the handover is still created with related_task_id = NULL, so the floor flow continues without the helper task. Left unchanged (no screen changes allowed); needs a checked RPC in a later batch if the task row is wanted. |
| submit_site_report (Daily Report, definer) | UPDATE | completion_percentage, actual_start/finish_date | Unaffected (verified, test b). |
| clone_task_templates_to_project (trigger on projects system change, definer) | DELETE all + INSERT | all | RLS bypassed as definer; **would delete baselined rows** if a project's production system is changed. Not changed this batch — flagged. |
| trg_project_closure_create_archive / trg_project_closure_amc_followup (definer) | INSERT | closure tasks | Unaffected (inserts bypass RLS as definer). |
| kpi-recompute, ai-agents | read only | – | ai-agents reads non-existent columns planned_end/actual_end (pre-existing). |

### Units
modules(project_id, name, module_code, module_type, is_archived); panels(module_id, panel_code…) belong to modules — no panel-set unit exists. project_schedule_units pre-filled with 28 'module' rows (one per distinct non-archived module code/name per project).

### Calendar / library
No holiday or working-calendar table existed (statutory_calendar is compliance deadlines). production_task_templates is per production_system with stage_number/phase_name/typical_duration_days/predecessor_stage_numbers and is copied into projects (clone_task_templates_to_project). New library differs: activity→task hierarchy with phase design/factory/site, qty/unit/output rates, crew, tracked/hold flags, entry mode; it is selected from, never cloned.

### Previous policies on project_tasks
SELECT is_active_staff; INSERT/UPDATE user_has_any_role(13 roles incl. chairman, head_operations, production_head, site_installation_mgr, factory supervisors, 3 directors); DELETE 9 roles. Helpers: user_has_any_role, is_tier1_or_super, user_can_access_project, is_active_staff.

## 2. SQL (key parts)
```sql
CREATE FUNCTION public.can_edit_schedule(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _uid IS NOT NULL AND (auth.uid() IS NULL OR _uid = auth.uid()) AND public.is_active_staff(_uid)
     AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.schedule_editor_roles s ON s.role=ur.role WHERE ur.user_id=_uid) $$;

DROP POLICY "Planning/production/ops can insert project tasks" ON public.project_tasks;
DROP POLICY "Planning/ops can delete project tasks" ON public.project_tasks;
CREATE POLICY "Schedule editors can insert project tasks" ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (public.can_edit_schedule(auth.uid()));
CREATE POLICY "Schedule editors can delete project tasks" ON public.project_tasks FOR DELETE TO authenticated USING (public.can_edit_schedule(auth.uid()));
-- UPDATE policy unchanged.

-- trigger trg_project_tasks_baseline_guard BEFORE INSERT OR UPDATE (SECURITY INVOKER):
--  INSERT: baseline_version forced NULL unless inside publish/revise.
--  baseline_version change outside publish/revise -> 42501.
--  any baseline column change:
--    inside publish/revise (transaction-local hstack.schedule_revise) -> allowed
--    OLD.baseline_version NOT NULL -> 42501 (editors too)
--    direct client (current_user authenticated/anon) and NOT can_edit_schedule -> 42501
--    definer functions (current_user = owner) keep working on un-baselined rows.
```
Full SQL in the migration file.

## 3. Role tests (impersonated, rolled back) — `src/test/sched1-foundation.rollback.sql`
```
(a) site_engineer direct planned_start_date UPDATE: rows=0 (unchanged)  ← blocked earlier by the existing UPDATE policy
    non-editor roles that pass the UPDATE policy: finance_director, sales_director, architecture_director, head_operations, production_head, chairman → 42501; their actual-column UPDATE rows=1
(b) site_engineer Daily Report submit completion_percentage: 10 -> 17, actual_start 26/11/2026
(c) planning_engineer INSERT + duration 3->4 (forged baseline_version cleared): ok
(d1) publish v1 without reason / direct duration UPDATE: v=1 / 42501
(d2) schedule_revise_task without reason: 22023 A reason is required for a schedule revision
(d3) schedule_revise_task non-whitelisted field: 22023 Field completion_percentage cannot be revised
(d4) revise with reason / unlock attempt baseline_version=NULL: {"duration_days": 6} / 42501
(d5) audit rows: publish:-, revise:Client moved slab pour
(e) v2 blank reason / v2 with reason: 22023 A reason is required to publish revision 2 / v=2
(e2) editor UPDATE snapshot: rows=0
(f) site_engineer comment insert / status update: inserted / rows=0 (still open)
(f2) notifications created: 2 to head_of_projects,planning_head
(f3) planning_engineer resolve / body edit: resolved by true / 42501
(g1) working_date(Sat 28/11, 2): 2026-12-01   (Sun 29/11 + holiday Mon 30/11 skipped)
(g2) working_date(Sun 29/11, 1) rolls forward: 2026-12-01
(g3) working_date(Fri 27/11, 3): 2026-12-01
(g4) working_days_between(27/11, 01/12): 3
(g5) 60-day span 01/12/2026–29/01/2027: 52
(g6) working_date(01/12/2026, 52): 2027-01-29
```
Fixtures: temporary team membership for the two test users, one BOQ-free construction task (existing Test project tasks derive % from BOQ quantities), and a test holiday — all rolled back.

## 4. Automated tests
66 files, 955 passed, 0 failed/skipped. Build OK.

## 5. Not verified / open points
- No active site_installation_mgr without an editor role exists, so the 42501 path was shown with the six other non-editor UPDATE-policy roles.
- One factory_supervisor account matched no rows on actual-column UPDATE either (pre-existing policy behaviour, unchanged).
- **Director parity:** finance/sales/architecture directors (and chairman, head_operations, production_head, site_installation_mgr, factory supervisors) can no longer add/remove tasks or change baseline columns; they keep actual-column updates. This follows the requested editor list; add rows to schedule_editor_roles if directors should edit.
- FactoryFloorMap helper task insert and clone_task_templates_to_project deletion behaviour (see table).
- Holidays use an is_active flag (deactivate, never delete), added beyond the requested columns.
- No security scan was run; nothing was auto-fixed.
