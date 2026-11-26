# BOQ-1b CONFIRM

## Result / Publish > Update
The database writer extension and consumed-line guard are applied. **Publish > Update** deploys the small screen change. No real project BOQ was created or finalised permanently; all database test fixtures rolled back. Existing downstream rules/data, roles/accounts/teams/flags/cron and earlier migrations are unchanged.

## A. Writers and active-account team report
`boq1_can_write` retains every BOQ-1 writer and adds `costing_engineer`, `quantity_surveyor`, `head_operations`. All checks remain caller-bound to user_roles, active/non-archived profile, `boq1_can_read` and `user_can_access_project`.

Final roles: super_admin, managing_director, finance_director, finance_manager, planning_engineer, architecture_director, project_architect, principal_architect, sales_director, planning_head, costing_engineer, quantity_surveyor, head_operations.

| Active account | Email | user_roles / profile | Active project-team membership |
|---|---|---|---|
| Mohammed Sayeed | costing@altree.in | costing_engineer / costing_engineer | Pebble Beach House |
| Venkat | designblr3@altree.in | head_operations / head_operations | Pebble Beach House |
| Quantity Surveyor | None | No account exists, including inactive accounts | Not applicable |

**Active accounts among these three roles not on any project team: none.** They are not on Test project - 1's team; tests used new rollback-only fixture project membership. No permanent team changes.

Screen controls already follow the server's `can_write` result; new roles therefore receive controls automatically where project access passes and the BOQ is fresh. View As now mirrors the writer list for presentation only, never substitutes for server permission. Everyone without server writer permission sees no entry/revision/acknowledge controls; readable roles see read-only, unreadable roles receive access refusal. Phones remain read-only. Existing legacy BOQs stay read-only in this screen.

## B. INSPECT: consuming tables and exact definition
Schema inspected via every FK referencing project_boq_items and every BOQ/line-id column, plus live get_running_bill and recalc_running_bill definitions. Exact source columns and constraints are in `docs/BOQ1B_INSPECT_RAW.md`.

| Table/path | Quantity / monetary columns | Consumption definition used |
|---|---|---|
| factory_report_quantities → factory_daily_reports + modules | today_qty, unit; rate_used, amount_inr, material_rate_used, material_amount_inr, material_rate_missing | Quantity: >0, parent status=submitted, report and quantity not archived, module.project_id matches line's header project. Units normalised for case/space and must match BOQ unit. |
| site_report_quantities → daily_measurements | today_qty, unit; rate_used, amount_inr, material_rate_used, material_amount_inr, material_rate_missing | Quantity: >0, matching row/report project, trade=daily_site_report, report_status=submitted, report not archived. Site rows have NO is_archived column. Blank site unit falls back to BOQ unit, matching legacy readers. |
| Frozen report snapshots in those same two tables | rate_used / material_rate_used (including zero), amount_inr / material_amount_inr | A non-null snapshot rate or nonzero snapshot amount, plus current submitted status OR submitted_at evidence OR non-null material_rate_missing capture marker. Historical frozen evidence remains protected even after archival/reopening. Monetary source amount = stored contractor amount + stored material amount, not a new cost calculation. |
| get_running_bill | Derived qty/value using line boq_qty / boq_rate and the same submitted factory/site quantities | NOT a separate stored quantity; factory + site summed once. Message identifies both sources and explains Running Bill uses the same units. Derived earned value uses the existing positive-BOQ cap. Positive report quantity also protects rate changes because repricing it would change the Running Bill. No bill function was modified. |
| measurement_line_items / recalc_running_bill | today_qty, cumulative_qty_snapshot, value_today_snapshot, labour_cost_today, material_cost_today, wip_today | FK points to separate legacy `boq_items`, NOT project_boq_items. No consumption assigned across separate models just because UUID column names resemble each other. Legacy calculation is untouched. |
| project_cost_rates | material_rate_inr, is_archived, project_id, boq_item_id | Editable configured rate, not a frozen snapshot/bill. Presence alone does not mean consumed. Once captured, report snapshots above protect it. No rate writes performed by BOQ guard. |
| project_cost_rates_log | field, old_value, new_value, changed_at, is_archived, boq_item_id | Audit of editable configured rate changes, not evidence of work/billing on its own; preserved, not counted as quantity or frozen billing. |
| subcontract_rates | rate_inr, lump_sum_inr, package_qty, unit, is_active | Editable contract rate configuration; package_qty is contract package size, not completed quantity. Actual frozen report rate/amount is guarded above. |
| boq_work_location_log | old_location, new_location, is_archived | Metadata audit only; no quantity or money. |
| boq_warning_acknowledgements / boq_entry_audit | line_id, warning/old_value/new_value | Entry/warning audit, not downstream consumption. |
| work_orders | quantity, unit, rate, total_value, boq_category, status/is_archived | No line-id field/FK; only category-level BOQ budget lookup in WorkOrdersTab. Cannot truthfully assign this amount/quantity to a particular BOQ line, so not treated as line consumption. |
| project_invoices / invoice_variations | amount_total/paid/outstanding/status; variation value | Project/invoice totals, no project_boq_items line reference; not allocated artificially to a line. |
| project_variations | linked_boq_item_id, quantities/final_cost/status/is_deleted | UI links the separate legacy boq_items model; no project_boq_items FK. Variation behaviour untouched and not merged with fresh BOQ revisions. |

No other consuming line-id FK/table exists in the inspected schema. Unknown/mismatched submitted report units are never added as if equivalent; removal/reduction/unit/rate changes refuse with a mismatch explanation rather than silently mixing units. All reads are scoped to the line's own project. No other project names or data are included.

## SQL / guard design
Full executable SQL: `drizzle/migrations/0081_boq1b_writers_and_consumed_line_guard.sql`.
- Replaces only `boq1_can_write` and patches `boq1_mutate` with preflight; adds `_boq1b_consumption`, `_boq1b_check_change` and a fresh-only BEFORE UPDATE safety trigger on project_boq_items. Previous migrations untouched.
- Guard preflights save/revise outside per-row error catching: consumed refusals are atomic, plain 42501 messages, not embedded JSON. Trigger also covers archival/quantity/rate/unit modifications of fresh lines.
- Removes only when neither submitted quantity nor frozen records exist; refuses reduction below factory+site consumed quantity; refuses unit changes with quantity; refuses rate changes with reported work/frozen values. Quantity increases allowed with balanced reasoned final revision. Nothing-consumed lines keep normal edit/removal behaviour.
- Same guard applies to already-consumed draft lines. Drafts with nothing consumed are unaffected.
- Read-only transaction SHARE locks on report headers/quantity tables prevent new consumption/snapshots appearing between guard check and commit. No rules or triggers on downstream tables were changed. These short-lived locks can briefly wait for/report writers until the BOQ transaction finishes; concurrency wait timing was not load-tested.
- Internal helpers have EXECUTE revoked from PUBLIC/anon/authenticated. Only existing checked BOQ path exposes a project-bound refusal. Existing direct-table writer policies unchanged.

Example actual rollback refusal:
> Item 1 — BOQ1B consumed concrete cannot have quantity 4 sqm below its consumed quantity. 5 sqm consumed: factory reports 3; site reports 2. Running bill uses the same quantities (not counted twice), value ₹500.00. factory report frozen rates/amounts, site report frozen rates/amounts: 2 frozen records, amount ₹250.00

## Real-account rollback proof
Reusable harness: `src/test/boq1b-consumption.rollback.sql`. Real auth subjects + SET LOCAL ROLE authenticated; new fixture projects, temporary project teams, BOQ lines and consuming records only. Final intentional `BOQ1B_ROLLBACK_OK` exception confirms **15 checks** and rolls back all rows.
1. Mohammed Sayeed and Venkat each create a draft BOQ and save 2 lines (₹2,000.00) through existing BOQ functions.
2. No Quantity Surveyor principal exists; real-account proof for that role cannot be run without account/role changes, which were prohibited. Role-list/control tests cover it; real principal verification remains unverified.
3. Fixture line: 10 sqm at ₹100; submitted factory=3 sqm, site=2 sqm, frozen material amounts ₹150 + ₹100. Draft removal and reduction to 4 refused.
4. Finalise at exact balance. MD direct-table update refused 42501 (Head Operations direct UPDATE is already RLS-filtered; direct-table rights were NOT widened).
5. Final removal, quantity=4, unit=kg, rate=₹110 each refused 42501, and assertions require item no/description, 5 sqm, factory 3/site 2/Running Bill, frozen ₹250 in readable messages.
6. Raising quantity 10→12 with a reason and control ₹2,200 succeeds; actor and old/new audit verified.
7. Unconsumed line rate ₹100→₹110 with reason/control ₹2,300 succeeds; removal with reason/control ₹1,200 succeeds and archive audit verified.
8. Missing revision reason refused; imbalance refuses Finalise; prior balance/locks/audit unchanged.
9. Vincent non-writer refused.
10. Separate rollback proves both new real writers get 42501 without project access (no team inserts in this check).
11. Post-test reads: fresh headers, fixture projects/lines/teams **all zero**.

Ten downstream function fingerprints compared before/after are **byte-identical**: get_running_bill, recalc_running_bill, save/submit site/factory reports, material snapshot helper, set_material_rate, upsert_subcontract_rate, schedule_revise_task. No downstream function/data edits, role/team changes or final real BOQ occurred.

## Screen evidence
`docs/boq1b-evidence/controls1440.png` and `refused1440.png`.
- Real signed-in Gaurav, confirmed existing test project's legacy BOQ read, then existing **View As Venkat / Head of Operations** control.
- New controls and final BOQ use mocked fixture READ responses, because real project has a protected existing legacy BOQ.
- Refusal uses mocked 42501 response containing the exact real rollback message above. It proves inline readable error and retained revision/reason/staged line, not a real browser database revision.
- No browser page errors or page horizontal overflow at 1440. Six writer-control tests confirm new roles, previous roles, non-writer View As and server-permission requirement.

## Tests / limitations
**995 tests passed in 74 files** (989 previous + 6 writer-control tests). Preview build OK. Final targeted rerun follows the screen persona-state cleanup.
Unverified:
- Real Quantity Surveyor create/save: no existing account.
- Successful fresh BOQ write/revision in real browser as a new role: rollback database tests passed; screenshot uses MD View As and mocked fresh data, not impersonated sign-in.
- Real browser consumed-refusal request: screen uses exact rollback response, not live fixture persistence.
- Archived/reopened frozen-only records, mismatched units, zero frozen rates, concurrent transaction waits and large quantities were not separately exercised in the rollback matrix.
- Work orders/invoices are category/project-level, not line-linked; no per-line billed allocation exists to check. If such links are later added, extend this read-only guard instead of treating project totals as line consumption.
