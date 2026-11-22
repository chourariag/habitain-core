# COST-1b CONFIRM

## Result

| Check | Result | Evidence |
|---|---|---|
| Read-only Cost report | PASS | Migration 0056; project Cost tab after Rates, existing `project_setup` flag used for both trigger and content; no flag values changed |
| Existing-principal role matrix | PASS | 31 active principals: 9 allowed, 22 denied; includes all existing multi-role principals; anonymous execution denied |
| Worker cost privacy | PASS | RPC worker `amount` omitted for Head of Projects, Planning Head and Costing Engineer; tested with populated site/factory fixture workers, not just empty arrays |
| Factory unallocated | PASS / limited branch coverage | ₹100 returned separately, never charged to project; all existing allowed Cost principals also pass `can_view_factory_cost`, so no existing allowed/no-factory-cost account exists for live negative-branch testing; denied principals cannot call Cost at all |
| Reconciliation | PASS | Worked day own labour ₹800 = Running Bill day ₹800; factory ₹300 = module in `get_factory_cost` ₹300; project total and task/module sum ₹1,965 |
| Frozen/corrected/legacy material | PASS | Real existing submit/save RPCs exercised in rollback; snapshots retained; site difference ₹875 and factory ₹240; included-material not flagged; legacy counted separately |
| Regression | PASS | Cost own labour and Running Bill both ₹6,365.46; earned ₹1,51,000; factory ₹0; subcontract ₹0; excess ₹19,500; Site Overview response identical before/after Cost call |
| Dates/cumulative | PASS | Empty dates return no days; every returned fixture-period day has a submitted report; window cumulative equals sum of returned day totals |
| Excel | PASS | Real signed-in workbook downloaded/read back: total ₹6,365.46, earned ₹1,51,000, excess ₹19,500; local export tests omit unauthorized per-person amount even if an unexpected payload contains it |
| Layout | PASS | Signed-in 360×800 and 768×1024 seen; no horizontal page overflow; 360px controls all at least 44×44px; complete date text visible after fixing narrow fields; final section visible above bottom bar |

## Migration / grants

- `0056_project_read_only_cost_report.sql`: only new `public.get_cost_report(p_project_id uuid,p_from date,p_to date)`.
- STABLE, SECURITY DEFINER, `SET search_path=public`. Internal `can_view_running_bill(auth.uid())`; no user-ID parameter.
- PUBLIC and anon execution revoked; authenticated execution granted. Live privilege inspection: `anon_execute=false`, `authenticated_execute=true`; Cloud-managed service/inspection grants also present. No new helper, table, direct column grant or RLS change.
- Cost tab uses the existing Rates/Setup `project_setup` flag; disabled content cannot be opened by its tab URL. The existing Rates tab and report screens were not changed.

## INSPECT findings

- Running Bill applies the positive-BOQ-quantity cap to combined site and factory quantities. Cost delegates cumulative value/excess to that unchanged reader, as of `p_to`.
- Site attendance amount matches Running Bill section B: round each present worker/day's hours × `coalesce(hourly_rate,monthly_salary/208,0)` to two decimals. It is included only on submitted site-report days. Historical labour allocation is proportional; worker-selected reports use exact allocations and retain unallocated site labour at Project level.
- Factory costs use submitted-report worker/module hours × attendance `effective_hourly_rate`. Factory-level unallocated hours are not project costs. Existing `get_factory_cost` provides the separately gated aggregate.
- Site expenses have no task field and show as Project level. Factory expenses are project costs only when linked to a module belonging to this project; factory-level expenses are excluded.
- Site BOQ quantity/task association uses `project_boq_items.schedule_task_id`; factory rows use `module_id`. Site rows without a task association show as Project level.
- COST-1a material values are frozen. Missing=true and legacy NULL are different states. Includes-material snapshots use captured amount=0/missing=false; current subcontract flags are not trusted for historical correction classification. A legitimate captured zero material rate also has no correction difference.
- `apply_record_edit` handles legacy `measurement_line_items`/headers, not the site/factory quantity tables. Its existing legacy notification issue remains outside scope. Daily Site Report's checked draft saver updates `today_qty` and subcontract fields, retaining all three material fields; zeroing an omitted quantity also retains them. Factory draft saver archives/reuses quantity identities and upserts quantity/remarks, retaining material fields. Submitted factory saves log the before/after report and re-submit; site saves use the existing edit log. COST-1a submit helper skips captured rows. None of these functions was changed.
- Existing access gates are reused unchanged. `can_access_labour_compensation` remains the existing compensation gate; this report does not return rates or salaries. Per-person rupee amounts require that gate inside the RPC. Frontend and Excel additionally honor the returned visibility boolean.

## Roles tested

Live **allowed**: managing_director; finance_director; sales_director; architecture_director (also principal_architect); super_admin; finance_manager; head_of_projects; planning_head; costing_engineer.

Live **denied**: head_operations; production_head; site_engineer (three principals, one also factory_supervisor); planning_engineer; accounts_executive; hr_executive/hr_admin; logistics_manager; electrical_installer; stores_executive; qc_inspector; project_architect (two); marketing; sales_executive (two, one also sales_associate); chairman; senior_architect (two); purchase_assistant; assistant_manager; anonymous.

No active assigned-role account: quantity_surveyor, site_installation_mgr, factory_floor_supervisor, senior_factory_supervisor. These were covered by frontend access tests only; no accounts or roles were created/changed. The profile labelled site_installation_mgr actually holds site_engineer in user_roles and was correctly denied on its assigned role.

Per-worker amounts present for existing Tier 1/Super and Finance Manager; omitted for Head of Projects, Planning Head and Costing Engineer. All nine existing allowed principals have factory cost access, so the allowed-but-no-factory-cost branch cannot be exercised with an existing account.

## Rolled-back worked day — 22/11/2026

| Part | Cost report | Reference |
|---|---:|---|
| Own labour at site | ₹800 | Running Bill same day ₹800; 6 hours exact task allocation ₹600 plus 2 project-level hours ₹200 |
| Factory project labour | ₹300 | Factory module cost ₹300; 6 allocated hours |
| Subcontract | ₹120 | Site ₹60 + factory ₹60 snapshot amounts |
| Material frozen | ₹370 | Site 2×₹125 = ₹250; factory 3×₹40 = ₹120; includes-material site quantity 5 adds ₹0 |
| Consumables | ₹300 | Site ₹200 + factory-module ₹100 |
| Expenses | ₹75 | Site ₹50 + factory-module ₹25 |
| **Total / cumulative** | **₹1,965** | Day parts and task/module sum both ₹1,965 |
| Factory unallocated (separate) | ₹100 | Factory attendance ₹400 = ₹300 allocated + ₹100 unallocated |

Factory-level expense ₹999 excluded from project. One missing-material row: quantity 4 × BOQ billing rate ₹100 = ₹400 reference value; not counted as material cost. One legacy NULL row counted as not captured, not as a missing rate. Worked fixture earned value ₹1,52,500 including fixture quantities; baseline returns to ₹1,51,000 after rollback.

### Correction evidence

| Location | Original quantity | Frozen rate | Frozen amount | Corrected quantity | Flag count for location | Difference |
|---|---:|---:|---:|---:|---:|---:|
| Site | 2 | ₹125 | ₹250 | 9 | 1 | (9−2)×125 = ₹875 |
| Factory | 3 | ₹40 | ₹120 | 9 | 1 | (9−3)×40 = ₹240 |

After site correction: total correction count 1, factory count 0. After both: site count 1, factory count 1. Frozen material remains ₹370 throughout. Includes-material quantity never contributes a correction flag. No captured material column was rewritten by Cost code; all fixture writes were rolled back.

## Tests / layout / scope

- New Cost frontend tests: **29 passed** (allowed/denied roles, date requests/validation, IST month boundary, project change, Excel numeric values and privacy).
- Focused Cost/Rates/Running Bill/factory privacy run: **107 passed**.
- Full suite: **662 passed, 4 pre-existing skips, 0 failures** with `--maxWorkers=2`. Initial unconstrained run had three timeout failures (account repository scan, parity scan, site scope test); all passed in the lower-concurrency rerun without changing those tests or screens.
- Live SQL checks recorded separately, not included in Vitest counts: 31-principal matrix, anonymous denial, populated privacy fixtures, worked-day and two corrections, empty days and final baseline/Site Overview invariance.
- Signed-in mobile workflow used a real existing account and actual RPC output: date range applied, data read back, worker group opened, Excel downloaded. 360px and 768px no page overflow; no Cost buttons below 44px. Narrow date fields found during visual check were fixed by moving Apply/Refresh below the two date inputs on mobile. Final content was visibly clear of the bottom bar. No runtime page errors; latest automatic build OK.
- Diff scope: new Cost reader/component/library/tests/docs; five additive lines in ProjectDetail; generated migration metadata/types. No changes to Running Bill, Daily Report, Factory report, Site Overview, Rates component, COST-1a snapshot helper, Setup, Materials import, nightly exports, RLS, flags, cron, schedules, reminders, accounts or roles. No new edge functions.

**Publish > Update.**