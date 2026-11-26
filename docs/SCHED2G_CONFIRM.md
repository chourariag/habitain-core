# SCHED-2g CONFIRM — My Tasks on Home

## 1. Inspect
- **Role report:** `docs/SCHED2G_ROLE_REPORT.md` (31 active accounts, 6 differ, none changed): hr@altree.in Aditya (hr_admin+hr_executive / hr_executive), karan@altree.in Karan Nadig (architecture_director+principal_architect / architecture_director), prod.dbr2 Bala (logistics_manager / delivery_rm_lead), prod.dbr4 Nazim Raja (site_engineer / site_installation_mgr), prod.dbr5 Vincent (factory_supervisor+site_engineer / site_engineer), salesblr George (sales_associate+sales_executive / sales_executive).
- **Screen role:** `get_user_role` returns `profiles.role` (first active row) for every role listed; production_head, factory_supervisor, factory_floor_supervisor, fabrication_foreman, site_installation_mgr, site_engineer, planning_engineer all pass through unchanged. No active account currently has profile role factory_supervisor, factory_floor_supervisor or fabrication_foreman.
- **TaskUpdateSheet save:** direct `project_tasks` update through existing RLS: Save progress writes completion_percentage, remarks, delay_cause, delay_resolution (+ actual_start_date/status 'In Progress' on first progress, actual_finish_date/status 'Completed' at 100). Start/Complete buttons write the same columns. The UPDATE policy uses `user_has_any_role`, which reads **profiles.role**: super_admin, MD, chairman, head_operations, production_head, planning_head, planning_engineer, site_installation_mgr, factory_floor_supervisor, factory_supervisor, three directors. **site_engineer and fabrication_foreman cannot save** (unchanged; the Home sheet opens read-only for them). project_tasks SELECT is any active staff (not project-scoped) — unchanged.

## 2. Role map (`src/lib/my-tasks-roles.ts`)
production_head → production_head, factory_supervisor · factory_supervisor → factory_supervisor · factory_floor_supervisor → factory_supervisor, factory_floor_supervisor · fabrication_foreman → factory_supervisor, fabrication_foreman · site_installation_mgr → site_installation_mgr, site_installation_manager(legacy) · site_engineer → site_installation_mgr, site_engineer, site_installation_manager(legacy) · planning_engineer → planning_engineer · Tier 1 / super_admin → all. Legacy keys site_installation_manager, site_manager kept. Used by Home, Design Portal MyTasksSection and MyTasksSummaryStrip.

## 3. Real-account proof (`src/test/sched2g-my-tasks.rollback.sql`, all undone)
- (a) Vincent with factory mapping: F00–F05 for TEST-M1/M2 (12 scheduled library tasks) only.
- (b) Nazim with site mapping: only S2G-SITE (site task added by Azad through schedule_add_task inside the rollback).
- (c) hr_executive (view-as): no My Tasks block (screenshot none390.png).
- (d) 2 undated legacy factory_supervisor rows on the project are not listed.
- (e) Nazim saved 40% with the exact sheet payload on F05-TEST-M2 (baseline v2) and S2G-SITE: 1 row each, In Progress 40%, dates unchanged; task then appears under In progress. Vincent (profile site_engineer) got 0 rows.

## 4. Screenshots (`/mnt/documents/sched2g/`)
MD "view as factory_supervisor" (no real factory account can sign in): m390.png, m390_sheet.png, d1440.png. Page width 390 / 1440 (no horizontal scroll); smallest tap target 44 px.

## 5. Tests / not verified
978 tests pass (4 new). Not verified: a real browser save from the Home sheet (proven at database level with real accounts); site-engineer read-only sheet visually.
