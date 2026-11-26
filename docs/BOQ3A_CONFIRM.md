# BOQ-3a — Budget vs Earned vs Actual per task (read-only, factory lines)

## Inspect findings
1. **Module mapping.** `factory_report_quantities.module_id → modules(id, project_id, name, module_code)`. Modules have no link to `project_schedule_units`; the only join is text: unit (`unit_kind='module'`, `unit_label`) ↔ module `name` or `module_code`. `module_code` is empty on every live module.
   Live check (trimmed, case-insensitive exact):
   - Pebble Beach House: 23/23 units match a module name exactly.
   - Test project - 1: Module 1–5 match; units `TEST-M1`, `TEST-M2` have no matching module (unmapped).
   - Test project 2 (the only locked link set): units `M1`, `M2` do **not** match modules named "Module 1…12" → both will show as **Unmapped**. Not guessed.
2. **Submitted rows.** Counted when `factory_daily_reports.status='submitted'`, report not archived, row not archived. `rate_used`/`amount_inr` are set in `submit_factory_report` for subcontract rows (contractor_id set); other rows have no amount → actual 0. Live data currently has **0** factory quantity rows.
3. **Cost tab.** `ProjectDetail` renders `ProjectCostReport` in the `cost` tab. The new section `BoqTaskReport` is a sibling below it; `ProjectCostReport` and `get_cost_report` are unchanged.
4. **Reuse.** `boq3_task_report` calls the existing private `_boq2_state(p_project)` (same source as `boq2_get`), so per-link budgets are the identical cumulative-paise-rounded values. No new table needed.

## Build
- Migration `0085_boq3_task_report.sql`: one function `boq3_task_report(uuid) → jsonb`, SECURITY DEFINER, `search_path=public,pg_temp`, `REVOKE ALL FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`. Access = `boq2_can_read` (else 42501). Returns `{"status":"no_locked_links"}` unless the active set is locked.
- Per link (factory lines): budget, allocated A, consumed C, earned = round(budget × C / A, 2) (not capped), overrun_qty = max(C − A, 0), actual = round(Σ amount_inr × share% / 100, 2), variance = earned − actual. Unmapped / ambiguous units: earned and actual 0, flagged with reason and the module names found. Broken links carry budget 0 (as in boq2_get) and a flag.
- Roll-ups: tasks, units, totals; site lines listed with budget only ("Waiting for unit on site reports").
- UI: `src/components/projects/BoqTaskReport.tsx` (+ `src/lib/boq-task-report.ts`), shown on the Cost tab only when links are locked; table on desktop, cards on phone.
- **No other migration, table, trigger or policy was added.**

## Rollback tests (real principals, fixture project, all undone) — 11/11 passed
Harness: `src/test/boq3-task-report.rollback.sql`. Writer = Mohammed Sayeed (costing_engineer); MD = Gaurav; non-reader = Lekha (marketing, not on the team).
- Before lock → `no_locked_links` ✔
- (a) M4, C=0 → earned 0 ✔
- (b) M1, A=4, C=2 → each ₹200 task earns ₹100 exactly ✔
- (c) M2, A=3, C=6 → earned ₹600 (budget ₹300, not capped), overrun 3, task overrun flag ✔
- (d) M3 has no exact module → unmapped, modules listed, earned 0; M1 matched by code " m1 ", M2 by name " m2 " ✔
- (e) draft-report, archived-report and archived-row quantities ignored (C stays 2; actual ₹250 = 500 × 50%) ✔
- (f) trims line ₹66.66 fully consumed → earned ₹66.66 to the paisa ✔; factory budget + site budget = BOQ total ₹1,116.66 ✔
- (g) non-reader → 42501 ✔
- (h) Running Bill and Cost report for Test project - 1 identical before/after (md5 `398412f0…`, `a3e46960…`, same as the BOQ-2 record) ✔

## Screenshots (mocked report data, real login)
`docs/boq3a-evidence/boq3a-1440.png`, `docs/boq3a-evidence/boq3a-390.png`. No page errors; no sideways scroll at 390.

## Tests
1,009 tests: full run had 3 unrelated timeouts under load; those files rerun alone pass (41/41 incl. cost-report and new BOQ-3a tests).

## Not verified
Live data with a locked set and submitted factory quantities (none exist); panel-set/site units; very large projects.
