# BOQ-2 CONFIRM — BOQ lines linked to schedule tasks

## 1. Inspection (no changes made)
**project_boq_items.schedule_task_id readers** (database functions that reference it):
- `get_cost_report` — groups site quantities by `b.schedule_task_id` (Site rows); NULL becomes its own ungrouped bucket.
- `get_site_report` — returns `task_id` per BOQ line for the Daily Report screen; NULL = line not tied to a task.
- `save_site_report_draft`, `submit_site_report` — derive task progress rows / value weights from lines' `schedule_task_id`; NULL lines contribute no task progress.
- `get_site_overview` — matches report quantities to tasks via `schedule_task_id`.
- `commit_project_setup_upload`, `get_project_setup_status` — Setup workbook writes/validates the column (front end sends "" by default).
- `schedule_clear_unscheduled_tasks` — checks lines referencing tasks before clearing.
- `get_running_bill` does **not** read it.
None was changed. Later candidates to switch to the new links: `get_cost_report` (task grouping) and `submit_site_report`/`get_site_report` (task value weights) once every active project has a locked link set. Not switched now.

**Units / task fields:** `project_schedule_units` (project_id, unit_kind, unit_label, day1); live data: 30 rows, all `module`, on 2 projects. `project_tasks` fields used: unit_kind, unit_label, task_type (enum: task, sub-task, qc_gate, sign-off, payment), is_qc_gate, is_payment_milestone, is_removed, baseline_version, library_task_id, task_id_in_schedule (code). Note: a task row cannot be inserted already removed (a trigger resets is_removed); removal goes through `schedule_remove_task` after a baseline.

**BOQ headers on active projects:** 7 headers, all `legacy / draft`; no fresh BOQ exists yet. Rule applied: latest non-archived header per project; legacy allowed; fresh must be `final`.

## 2. SQL
Migrations: `drizzle/migrations/0082_boq2_task_links.sql` (tables, indexes, grants, RLS, policies, functions), `0083_boq2_state_person_name.sql` (name column fix in the read function), `0084_boq2_revoke_direct_writes.sql` (explicit revoke of INSERT/UPDATE/DELETE from signed-in users and all access from anonymous).
- Tables: `boq_link_sets` (one active per project; draft/locked, version, locked_at/by, rules_source), `boq_unit_allocations` (quantity ≥ 0), `boq_task_links` (0 < share ≤ 100, 2 decimals), `boq_link_audit` (action, reason, old/new, actor, time). All server-filled actors/times; replacements archive old rows (no deletes).
- Access: SELECT only for signed-in users with `boq2_can_read` (= `boq1_can_read` OR writer); no client writes.
- `boq2_can_write`: signed in, active profile, `user_can_access_project`, and (`boq1_can_write` OR `can_edit_schedule`).
- `boq2_get` (read), `boq2_mutate` actions `save_split`, `save_shares`, `lock`, `revise`; `boq2_suggest_equal_split`, `boq2_suggest_copy_shares` (read-only, same project, matched by library task).
- Budgets: per line, links ordered by unit/task code; each link budget = round(cumulative raw, 2) − round(previous cumulative, 2), raw = unit qty × rate × share/100. The per-line total therefore equals round(qty × rate, 2) exactly when fully linked.
- Broken links: computed on read (task removed, moved unit, no longer ordinary task, or unit gone); coverage drops, `revision_needed` set when locked.

## 3. Rollback tests (real principals, fixture project, all undone)
Harness `src/test/boq2-links.rollback.sql`; result `BOQ2_ROLLBACK_OK: 19 checks`. Writer Mohammed Sayeed (costing_engineer), schedule editor Gaurav Chouraria (MD), non-writer Lekha (marketing). Fixture baseline published only on the rolled-back fixture project.
- Draft fresh BOQ refused for linking ✔
- (i) equal split 10 over 3 units → 3.33 / 3.33 / 3.34 ✔
- (a) split 3+3+3 ≠ 10 refused ("add up to 9 but the line quantity is 10") ✔
- (b) shares 99.99% refused ✔
- (c) other-unit task, removed task, QC gate, payment milestone each refused with reason ✔
- copy helper: M2 matched 2 tasks, M3 matched 1 with 1 reported unmatched ✔
- (d) partial lock refused "1 of 2 line(s) are not fully split and shared"; full coverage locks ✔
- (h) task budgets sum ₹633.33 = BOQ total, unlinked 0 ✔
- (e) locked direct save refused 42501; direct table UPDATE refused 42501; short reason refused; reasoned revision saved and audited (revision + revision_shares rows, actor = writer) ✔
- (g) non-writer refused 42501 ✔
- (f) `schedule_remove_task` on a linked task → 1 broken line ("task was removed from the schedule"), linked < total, revision needed ✔
- (j) Running Bill and Project Cost outputs for Test project - 1 identical before/after (md5 398412f0…, a3e46960…) ✔
Function fingerprints for get_running_bill, recalc_running_bill, save/submit site and factory reports, _snapshot_report_material, schedule_revise_task identical to the BOQ-1b record; schedule_add/remove/recalculate, publish, get_cost_report, get_site_report, get_site_overview, setup upload/status not redefined by these migrations. Post-run: 0 fixture projects, sets, links, audit rows, team rows.

## 4. Screenshots (docs/boq2-evidence) — all MOCKED data
Signed in as Gaurav (real login); the links data was a mocked server response because no real project has a final fresh BOQ and fixtures roll back. lines1440/1024, detail1440/1024, budget1440/1024, lines390 (read-only on phone). No page errors; no page-level sideways scroll at any width (the line table scrolls inside its own box on phones).

## 5. Tests and not verified
Full suite: 998 tests / 75 files passed. Not verified: a real browser save/lock/revision (only rollback SQL as real principals); panel-set/site units (no such units in live data); performance on very large BOQs; Quantity Surveyor account (none exists).
