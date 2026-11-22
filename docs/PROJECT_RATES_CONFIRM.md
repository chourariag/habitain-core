# Project Rates — CONFIRM

## Inspection
- Existing `subcontract_rates` targets a BOQ item or other-work description. Partial unique indexes cover project+contractor+BOQ item and project+contractor+normalized description. Per-unit rates must be positive; lump sums and package quantities must be positive. Setup validates and writes them transactionally; its workbook/writer are unchanged.
- `project_boq_items` belongs to versioned `project_boq`; item key is BOQ version+sno. Work location and BOQ billing rate already exist. Rates imports resolve project+sno against the latest version, not an older item ID.
- Existing site/factory submission functions preserve subcontract rate snapshots. SEC-3/0050 quantity reads use safe column grants. New material fields remain outside those lists.
- `can_view_running_bill` allows Tier 1, Super, Finance Manager, Head of Projects, Planning Head, QS and Costing Engineer. `can_access_labour_compensation` is different and was not broadened. ProjectDetail already gates Running Bill by the shared commercial role list and other tabs by existing flags.

## Applied changes
- **0053**: private RLS-enabled `project_cost_rates` and `project_cost_rates_log`; `subcontract_rates.includes_material` defaults false; shared audit triggers log both existing Setup writes and new Rates writes.
- **0054**: private quantity material fields and submit-only capture; checked readers omit material keys for non-commercial callers.
- **0055**: captures the actual current material rate even when an included-material contractor contributes zero material amount; preserves inactive subcontract status during Excel import.
- Authenticated-only SECURITY DEFINER RPCs, `search_path=public`: `get_cost_rates`, `set_material_rate`, `upsert_subcontract_rate`, `deactivate_subcontract_rate`, `validate_cost_rates_upload`, `apply_cost_rates_upload`. PUBLIC/anon EXECUTE revoked. Read/validation functions STABLE. All use `auth.uid()` with existing Running Bill authorization; no caller-supplied user ID.
- Private helpers have no authenticated/anon/PUBLIC EXECUTE: `_cost_require_project`, `_cost_rate_log`, `_validate_cost_subcontract`, `_snapshot_report_material`.
- Rates appears after Running Bill, gated in both trigger and content by the existing `project_setup` flag and commercial role list. No flag value changed.
- No existing policy, Setup writer/workbook, Materials import, report-screen code, Running Bill function, export manifest, account, role, reminder or schedule changed. Existing subcontract monetary SELECT was narrowed to safe metadata grants without changing RLS; checked commercial reads remain available.

## Evidence
| Check | Result |
|---|---|
| Existing account matrix | PASS: 31 principals, including multi-role accounts; 9 allowed, 22 denied; six RPCs each = 186 checks |
| Anonymous RPCs | PASS: all six denied; 192 total RPC checks including anonymous |
| Direct access | PASS: six new-table write attempts, six new material-column reads, one subcontract rate read denied |
| Rate validation/audit | PASS: ALTREE rejected with specified message; per-unit/lump-sum positivity and percent package=100 enforced; deactivation retains row; both writer paths logged |
| Excel | PASS: dry run applies nothing and lists all rejected rows; rejected Confirm applies nothing; valid Confirm atomic and preserves inactive status |
| Material snapshots | PASS: real first submits capture; later rate edits, quantity edits and re-submits do not rewrite snapshots; legacy site submitted rows remain NULL |
| Commercial privacy | PASS: non-commercial checked site/factory readers omit material keys entirely |
| Running Bill | PASS: value earned 151000; own labour 6365.46; factory labour 0; subcontract 0; excess 19500 |
| Layout | PASS: signed-in 360px and 768px seen, no horizontal page scroll; tablet uses cards to avoid sidebar crowding |
| Browser upload | PASS: downloaded real sheet, uploaded valid three-row sheet, dry run showed zero rejections and enabled Confirm; cancelled without applying |

Allowed existing roles tested: managing_director, finance_director, sales_director, architecture_director (also principal_architect), super_admin, finance_manager, head_of_projects, planning_head, costing_engineer. Denied existing roles include site_engineer (also factory_supervisor), head_operations and production_head; all other existing active principals were checked too.

No existing active account: quantity_surveyor, factory_floor_supervisor, senior_factory_supervisor. These were component/UI-tested only; no account or role was created/changed. Site Installation Manager was also denied in UI tests.

## Worked examples — rolled back
| Quantity | Material rate used | Material amount | Missing |
|---|---:|---:|---|
| Site, own labour, qty 2 | 125 | 250 | false |
| Factory, qty 3 | 40 | 120 | false |
| Site, contractor includes material, qty 5 | 125 | 0 | false |
| Site, no material rate, qty 4 | NULL | 0 | true |

Changing rates to 999/site and 888/factory, then quantities to 9 and re-submitting, retained original material rates and amounts (125/250 and 40/120). All fixture rows/rates/logs were rolled back.

## Test totals and limits
- New frontend tests: **53 passed** (32 rules/Excel + 21 component access/edit/Confirm tests).
- Final full suite: **633 passed, 4 skipped**, 50 files. Skips are existing legacy-schedule checks. An initial parallel run hit one existing scanner test timeout; rerun with two workers passed all tests without changing that test.
- Latest automatic build: OK. Live real-browser rate writes/Confirm were intentionally not applied to the live project; positive writes and Confirm were verified inside rollback transactions and component tests.
- No Cost report or P&L was added; the new rates and private snapshots are ready for COST-1b. No new cost fields were exported.

**Publish > Update.**