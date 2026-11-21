# FAC-1 verification CONFIRM

Verification date: 21/11/2026 UTC (22/11/2026 IST). Verification-only continuation of FAC-1.

## Results 1–7

| Item | Result | Evidence / reason |
|---|---|---|
| 1. Database role matrix | PASS for every existing principal; three roles have no account | 15 active existing principals, 120 rolled-back checks across attendance, confirmation, draft, submit, cost, BOQ location and safe reads. Includes all assigned roles, not profile mirrors. No accounts or role changes. Missing factory_floor_supervisor, senior_factory_supervisor and quantity_surveyor use UI permission tests. |
| 2. Direct access | PASS after defect fix | 30 authenticated INSERT/UPDATE/DELETE attempts across ten tables denied with 42501; three quantity snapshot-column reads denied; two attendance wage-column reads denied; all 17 FAC-1 anonymous function calls denied. 52 checks in total. |
| 3. Exports and docs | PASS for wiring, projections and tests | Ten factory sources already joined the P8 shared manifest; now 36 files documented. Removed factory attendance wage amount; factory files have no rate fields or wages. Both existing export-nightly and export-latest functions redeployed. No new functions or schedule changes. Actual export execution not performed. |
| 4. No-factory Running Bill | PASS | Test project - 1: earned 151000, site own labour 6365.46, factory labour 0, subcontract 0, excess 19500. Checked before the worked transaction; its final rollback restores the unchanged baseline. |
| 5. Worked-day reconciliation | PASS | A rolled-back day through the existing production_head account produced attendance 800 = allocated 600 + Unallocated 200; difference 0. Forty sqm at fixture BOQ rate 1000 earns 40000; consumables 200; module total cost 800. Combined bill earned 191000; factory labour 600; site labour and excess unchanged. |
| 6. Signed-in 360px/768px factory UI | NOT TESTABLE | Existing signed-in MD account reaches mandatory password change before factory screens mount. Every eligible account inspected still has that flag. User explicitly chose “Leave screens unverified”; no password, profile or account changed. No claim about factory overflow, clipping, sticky bars or 44px targets. |
| 7. Production behavior preserved | PASS by source diff and transaction | current_stage stayed Main Frame; one source-linked production log created for one submitted block. Kanban, QC, dispatch, production stage definitions and old SupervisorDailyLog have zero file changes relative to the pre-FAC commit. No daily_production_logs custom triggers exist. |

Live camera and GPS capture were **not tested on a phone**. The worked database day seeds temporary photo metadata, not a camera capture or storage upload. No factory-screen screenshots were produced; the only captured view shows the password gate at 360px.

## Existing-principal matrix

A = allowed; D = denied by role check. “Attendance” includes morning save and evening confirmation. All checks ran as `authenticated` with each existing principal's caller ID, inside transactions that rolled back.

| Assigned role(s) | Accounts | Attendance | Draft | Submit | Cost read | BOQ change | Attendance/report reads |
|---|---:|---|---|---|---|---|---|
| production_head | 1 | A | A | A | A | D | A |
| head_operations | 1 | A | A | A | A | D | A |
| finance_manager | 1 | D | D | D | A | A | A |
| head_of_projects | 1 | D | D | D | A | A | A |
| planning_head | 1 | D | D | D | A | A | A |
| costing_engineer | 1 | D | D | D | A | A | A |
| site_engineer | 2 | D | D | D | D | D | D |
| factory_supervisor + site_engineer | 1 | D | D | D | D | D | D |
| managing_director | 1 | A | A | A | A | A | A |
| chairman + managing_director | 1 | A | A | A | A | A | A |
| finance_director | 1 | A | A | A | A | A | A |
| sales_director | 1 | A | A | A | A | A | A |
| architecture_director + principal_architect | 1 | A | A | A | A | A | A |
| super_admin | 1 | A | A | A | A | A | A |
| factory_floor_supervisor | 0 | UI A | UI A | UI A | UI D | rule D | rule A |
| senior_factory_supervisor | 0 | UI A | UI A | UI A | UI D | rule D | rule A |
| quantity_surveyor | 0 | rule D | UI D | UI D | UI A | rule A | UI A |

The legacy `factory_supervisor` role is not silently promoted to `factory_floor_supervisor`. The chairman+MD account is allowed because it holds MD; chairman alone remains outside Tier 1. Frontend active-role behavior is unchanged; multi-role union was verified at the database boundary, not through the blocked browser.

Factory supervisor cost requests are absent in UI tests. Operational attendance/report responses omit wage and rate fields; direct factory quantity commercial columns and attendance wage snapshots are denied to every authenticated client, including commercial viewers. Commercial viewers use get_factory_cost. Factory expenses retain entered consumable/site-expense amounts; these are not worker wages.

## Defects found and fixes

1. **Live table ACLs overrode intended private-column grants.** Authenticated/anonymous table grants included broad privileges, making private quantity snapshots and attendance wages readable at the table boundary. Migration **0050_factory_direct_access_privacy_fix** removes direct writes and anonymous table access, restores safe authenticated SELECT projections and preserves service-role access. No RLS, role-function or business-flow changes.
2. **Factory attendance export included worker wage amount.** Removed `amount` from its factory v1 projection and added a no-wage/no-rate manifest regression. Storage inspection found zero factory export files, so no previously written factory CSV schema was replaced. Existing site wage exports remain unchanged.
3. **Export documentation still said 26 files and omitted factory columns.** Updated count to 36 and documented all ten factory projections; AGENTS records the factory export boundary.

Verification-only defects corrected: a new test used an unsupported `exact` role-selector option; replaced with an anchored name matcher. A combined SQL test had an ambiguous local/column alias; renamed it and reran successfully. The first fully parallel suite hit one 5-second timeout in an unchanged repository scanner; rerun with two workers passed without changing application code or test timeout.

## Tests / limitations

- Full suite: **554 passed, 4 skipped, 47 files passed**. The four skips are the already-preserved legacy callback security tests; no FAC-1 UI unit tests skipped.
- Factory/export scoped suite: **56 passed, 0 skipped**, including new absent-account UI action tests and privacy checks. Existing-principal database matrix: **120 passed**. Direct/anonymous regression: **52 passed**.
- Three roles have no existing active principal; those live role cases cannot be exercised without prohibited account/role changes.
- Worked transaction asserts exact baseline, labour reconciliation, module value/cost, unchanged current_stage, one source-linked log and combined Running Bill totals.
- SQL regression sources: `docs/FAC1_ROLE_MATRIX_ROLLBACK.sql` and `src/test/factory-access.rollback.sql`.
- Existing latest export log is still `running` from 16/11/2026; no export was invoked or unrelated export-log state changed. Deployment and projection tests do not establish a successful nightly run.
- All fixture report/attendance/photo/BOQ rows rolled back. Factory persistent report/attendance/photo counts remain 0. `reminder_events` remains 0; no writes to it, no flags, cron, schedules, accounts or roles changed.
- Latest automatic preview check: **build OK**, 21/11/2026 18:56:20 UTC. No app build/typecheck run manually.

## Diff summary

FAC-1 originally added production-page tab/cost wrappers; its existing ProductionContent body is byte-unchanged. Protected files: ProductionKanban, SupervisorDailyLog, QC components, dispatch components/pages and production-systems: **0 changed lines**. This continuation changes only factory ACLs, factory export projection, tests and documentation. It adds no feature and changes no production transition.