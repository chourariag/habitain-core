# BOQ-3b confirmation — optional unit split for site quantities

## Migration
- `drizzle/migrations/0087_boq3b_site_quantity_units.sql` (number 0087). Commit: `fa1db16e`.
- Adds table `site_quantity_units` (SELECT-only grant to authenticated, RLS `user_can_access_project`, same as `site_report_quantities.srq_read`; no client INSERT/UPDATE/DELETE), functions `site_set_quantity_units`, `site_get_quantity_units`, and replaces `boq3_task_report`.
- Not changed: `save_site_report_draft`, `submit_site_report`, `get_site_report`, `get_running_bill`, `get_cost_report`, `site_report_quantities`, any existing money calculation.

## Access rule used by `site_set_quantity_units`
`can_write_site_report(auth.uid(), project)` (project access + Tier 1/Super, site_engineer, site_installation_mgr, head_of_projects, planning_head), plus the `_site_report_check_window` date window and the same "submitted report may only be edited by its submitter" rule `save_site_report_draft` applies. Reason: the split is part of the report entry, so it must be exactly as editable as the report itself — no wider, no narrower. Reader `site_get_quantity_units` uses `user_can_access_project`, the same rule as `get_site_report`.

## Rollback tests (`src/test/boq3b-site-units.rollback.sql`, real principals, fixture project, rolled back) — 15/15 PASS
1. Set split — pass
2. Clear split (empty array) — pass
3. Unit not allocated rejected ("Unit M9 is not allocated to this BOQ line") — pass
4. Sum above quantity rejected — pass
5. Zero / negative / NaN rejected — pass
6. Factory line rejected ("Factory lines are reported in the Daily Factory Report") — pass
7. Non-writer refused 42501 — pass
8. Direct client insert refused (non-writer and writer) — pass
9. Draft report counts nothing — pass
10. Submitted report counts the split; earned = round(400 × 2 / 4, 2) = 200.00, actual = 300 × 2/3 = 200.00 — pass
11. Site unit roll-up and totals.site_earned / site_actual — pass
12. Unassigned remainder (1) shown and site_unassigned_lines = 1 — pass
13. Factory section unchanged vs pre-0087 function (md5 `302793e303e6819b54a9e369429f9396`, old = new) — pass
14. Stale split (split 2 > qty 1) flagged "Unit split exceeds reported quantity" and not counted; reader shows stale — pass
15. Running Bill and Cost report identical before/after — pass

## md5 proof (live project tp1)
- Running Bill: `673f66cc03743c8205e9a7540423ab25` before = after
- Cost report: `a2ad8efac7ed8ba232f51fe5609474cd` before = after
- Factory output of `boq3_task_report` on fixture: `302793e303e6819b54a9e369429f9396` old function = new function

## UI
- Daily Site Report: collapsed "Which unit?" under site BOQ quantity rows (qty > 0, line has allocated units); quantity box per allocated unit, running "Unassigned", "Unit not stated" hint, mismatch warning "Unit split no longer matches the quantity". Saving flushes and saves the draft first, then calls `site_set_quantity_units`. Optional; submit unchanged.
- Cost tab BOQ section: site unit tables (Budget, Earned, Actual, Variance) and "Unit not stated: N qty" per line, replacing "Waiting for unit on site reports".

## Tests / build
- Full suite: 1,019 tests passed (78 files). New: `src/test/boq3b-site-units.test.tsx` (8). Two existing test mocks updated for the extra reader call.
- Build: OK.
- Not verified: a real in-browser split save and the 390px layout in a live browser (layout uses stacked grid and 44px inputs).
