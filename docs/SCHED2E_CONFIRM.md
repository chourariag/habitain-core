# SCHED-2e CONFIRM — Baseline scope + responsible roles on library tasks

## 1. Inspect
### My Tasks role mapping
- `MyTasksSection` (only rendered in Design Portal, phaseFilter = Design/Design & Engineering/Engineering) and `MyTasksSummaryStrip` (not rendered anywhere) use `ROLE_MAP` and filter `project_tasks.responsible_role = mapped` (+ `phase IN phaseFilter` when given):
  - production_head → production_head
  - factory_supervisor → factory_supervisor
  - factory_floor_supervisor → (not mapped: sees nothing)
  - site_installation_mgr → (not mapped; map key is `site_installation_manager`, which is not an app role)
  - site_engineer → (not mapped)
  - MD / super_admin / Tier 1 → all
- Actuals & progress (`MicroScheduleTab`) for non-full-schedule roles filters `responsible_role === userRole` (exact app role name). `PRODUCTION_VIEW_ROLES` (production_head, factory_floor_supervisor, fabrication_foreman, site_installation_mgr, site_engineer) get the roll-up with "My Open Tasks" using the same exact match. No phase filter is applied there.
- The screen role comes from `get_user_role` = `profiles.role` mirror, not `user_roles`. Mismatches found (not changed): prod.dbr5 (Vincent) user_roles=factory_supervisor, profile=site_engineer; prod.dbr4 user_roles=site_engineer, profile=site_installation_mgr. No active account's screen role is factory_supervisor or factory_floor_supervisor.
### Legacy template values
- Factory: `factory_team` (184), `Factory Supervisor` (80 + 25 Panel), `factory_supervisor` (28), `qc_inspector`, etc. Site: `Site Supervisor` (40), `site_installation_manager` (32), combined values.
- Decision: factory activities 01–12 → **factory_supervisor** (the value My Tasks maps and legacy rows use; factory_floor_supervisor is unmapped and held by nobody). Site activity 13 → **site_installation_mgr** (matches Actuals for that role; legacy `site_installation_manager` matches no real role). 14/15 → null.

## 2. SQL
- `drizzle/migrations/0075_sched2e_baseline_scope_library_roles.sql`: new `schedule_library_tasks.responsible_role`; `schedule_add_library_tasks` copies it; `publish_schedule_baseline` snapshots and stamps only `unit_label IS NOT NULL AND NOT is_removed`, refuses with "No scheduled tasks to publish"; backfill.
- `drizzle/migrations/0076_sched2e_factory_role_matches_my_tasks.sql`: factory default switched to factory_supervisor.
- `schedule_repeat_for_units` unchanged: it already copies the source task's responsible_role. Guards, revise/add/remove unchanged.
- Backfill touched 12 project tasks (the 12 test tasks on Test project - 1), now factory_supervisor.

## 3. Rollback tests (`src/test/sched2e-baseline-scope.rollback.sql`, ended `EVIDENCE OK (rolled back)`)
Accounts: Azad (named editor), prod.dbr4 (screen role site_installation_mgr, non-editor), Vincent (user_roles factory_supervisor).
- (a) v1 snapshot 13 tasks (12 + 1 site task added in test), 0 unit-less; 13 unit tasks stamped v1; 187/187 unit-less rows baseline_version NULL.
- (b) after v1, prod.dbr4 saved 40 %, In Progress, actual start on a unit-less legacy task (1 row). Detail edit 42501, delete 42501, clear-unscheduled 42501.
- (c) direct unit edit 42501; revise → days 5, role production_head; add T2E-ADD ok; remove F00-TEST-M1 → is_removed.
- (d) non-editor publish 42501, revise 42501.
- (e) v2 without reason 22023; v2 with reason → 13 tasks, includes T2E-ADD, excludes removed F00-TEST-M1; unit-less still NULL (187).
- (f) Mahesh Villa (no unit tasks): `22023 No scheduled tasks to publish`.
- (g) Z01 added from library got site_installation_mgr. As Vincent under RLS, filter factory_supervisor → F00–F05 × TEST-M1/M2 (12 rows). As prod.dbr4, filter site_installation_mgr → Z01.
Post-rollback: 0 baselines, 199 tasks, legacy task back at 0 %.

## 4. Screenshots (`/mnt/documents/sched2e/`)
- publish-panel.png: "12 scheduled tasks will be in the baseline" / "187 legacy tasks without a unit are not part of the baseline".
- actuals-factory-supervisor.png: Actuals & progress viewed as factory_supervisor (MD "view as" override) — "Showing your tasks only (19 of 199)" with library tasks F01-TEST-M1 etc.

## 5. Tests and gaps
- Full suite 972 tests; new tests: publish scope lines, role dropdown payload. One unrelated parity test timed out under load once and passed on re-run.
- Not verified: a real factory account's screen (none has a factory screen role); Home has no My Tasks for factory/site roles today; revise of unit-less rows via schedule_revise_task is still possible for editors (unchanged).
