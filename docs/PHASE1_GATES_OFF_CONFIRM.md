# PHASE1-GATES-OFF — CONFIRM

## Scope and result

Frontend only, as explicitly reconfirmed by the user on 22/11/2026 after the live database blocker was reported. No migration, database write, policy/grant/storage change, flag-row change, role/account mutation, cron/schedule/reminder change or new edge function. No checklist or approval code was deleted. No existing project data was changed; no production stage transition or workbook Commit was submitted.

`src/lib/phase-flags.ts` exports `PREPROD_GATES_ENFORCED = false` with the requested Phase 2 comment. Setting it to true restores the original screen gate behavior. The same constant is used throughout; there is no database feature flag for this phase switch.

**Important limitation:** an existing enabled database trigger independently enforces Setup approval and approved GFC records on module stage writes. Frontend-only bypass does not make those writes succeed. This is not an end-to-end removal of the server gate layer. The user selected **Keep frontend only** after being informed; the restriction remains intact.

## INSPECT findings and reader inventory

| Reader / surface | Before | Phase 1 false |
|---|---|---|
| `PreProductionChecklist.tsx` | Habitainer five rows: Sale Agreement + Scope, E-3 S1, E-5 H1, E-8 GFC Budget, P-1 Planning handover. ADS uses its separate four-row gate list. `usePreProdGates` reads design stages and `get_preprod_gate_flags`, with focus/visibility refresh. Habitainer `setupReady` requires the first four gates; ADS requires all four. | ProjectDetail does not mount the checklist; the component also returns null independently. The hook skips gate-only reads/focus listeners. It does not fabricate Completed statuses or change data. |
| `ProjectSetupApprovalSection.tsx` | Reads project approval/status/timestamps and `project_setup_approvals`; records Planning Head and Head of Projects decisions and sends notifications. | Not mounted by ProjectDetail; independently returns null. No approval reads, decisions or notifications from this surface. |
| `ProjectSetupUpload.tsx` | Legacy uploader: `uploadBlocked = !isAdsProject && !setupReady`; ADS was already exempt. Its legacy role list differs from the current workbook uploader and does not include Planning Head. ProjectDetail already hides this legacy uploader behind `LEGACY_PROJECT_SETUP_UPLOAD_VISIBLE=false`. | `uploadBlocked` is false for both divisions. Legacy visibility and role list are unchanged, as requested. No legacy import/BOQ writer was changed. |
| `ProjectSetupWorkbook.tsx` | Actual Setup-tab uploader: Planning Head, four Tier 1 directors, Super Admin. Reads `get_project_setup_status`; checks file/validation state, not pre-production or Setup approval. Uses checked atomic upload entrypoints, including the existing optional subcontract-rate wrapper. | Unchanged; validation remains available without gates, subject to the unchanged role rule and `project_setup` module flag. |
| `stage-gates.ts` / `evaluateStageGate` | Gate 5 Setup approval runs first, Gates 1/2/3 require H1/H2/H3 mapped from stage name, Gate 4 checks previous production-stage QC. | Only Setup and H1/H2/H3 checks are skipped. Previous-stage QC logic is byte-for-byte unchanged. GFC mapping helpers remain intact. |
| `ProductionKanban.tsx` — only `evaluateStageGate` caller | Reads project Setup approval and GFC records; shows column locks and “Requires H…” labels; checks gates on drop before opening stage-close/wastage flow. | Skips Setup/GFC-only reads and requirement labels. Calls the updated evaluator for display/drop. Previous QC lock reasons remain visible. Immediate-next-stage check and stage-close/wastage/write flow remain unchanged. |
| `FactoryFloorPreProdBanner.tsx` / Factory Floor Map | Read-only warning for active non-ADS projects with modules and fewer than five complete gates, using design stages/contracts/scope. Does not itself block navigation. | Returns null before mounting its old implementation; no warning or gate-only reads. |
| `GfcSetupDeadlineBanner.tsx` | Reads GFC Budget approval timestamp and displays a 72-hour Setup deadline, refreshing once per minute. Used by legacy Setup uploader. | Returns null before mounting its old implementation; no read/timer. This is the additional gate-only surface hidden. |
| `BillingMilestonesSection.tsx` | Offers `project_setup_approved` and GFC approval events as milestone trigger choices; does not evaluate stage gates. | Unchanged. Existing milestone configuration and status are not rewritten or forced to fire. |
| Safe project projections / project lists/detail/archive | Public projection retains Setup boolean/status/timestamps. ProjectDetail consumes them only in its approval card; archive/list output is data, not a production lock. | Retains stored values including false / not_submitted; no synthetic approval and no projection/export schema change. |
| Nightly project export: `_shared/export-schema.ts`, `export-nightly` | Versioned project manifest includes `project_setup_approved`, `project_setup_approved_at`, `project_setup_status`. | Still exports stored values, including false / not_submitted. Does not read the frontend phase switch. |

Other design-stage/GFC consumers were inspected separately from gate enforcement: DesignSchedule and ProjectDesignScheduleTab track actual design-stage progress; ProjectArchitectCard assigns the architect; DesignPortal/GFCStatusCard/DetailLibrary/GFCQCChecklistSection perform drawing QA and issuance; Site Hub drawings, integrated drawings and ClientPortal/ClientDocuments display permitted records/certificates; BudgetTrackingTab and legacy Setup BOQ import inspect E-5 to preserve `gfc_pending_h1`; finance/work-order budgets, notifications/email templates, client progress and readiness drawings reference real GFC data. These are independent design/document/commercial/safety workflows, not extra readers of the three Setup gate fields or `get_preprod_gate_flags`, and were not altered. Their existing flags, permissions, statuses and QA/issuance rules remain unchanged. No design-stage tab was opened in browser verification because its existing lazy-seeding behavior can write missing rows.

## Live server inspection — unchanged

- `commit_project_setup_excel_upload` delegates to `commit_project_setup_upload_validated`, then the existing atomic writer. Its checked path permits Planning Head / Tier 1 / Super Admin, requires the `project_setup` feature flag and project existence, and validates workbook rows. **No pre-production, Setup approval or GFC gate check.** It has other data-validation checks; “only role and flag” describes access gates, not the whole function.
- `get_project_setup_status` requires signed-in active staff, project existence and `project_setup` enabled. It applies existing commercial-rate visibility roles. **No pre-production, Setup approval or GFC gate check.** It does not require an uploader role just to read operational setup data.
- `get_preprod_gate_flags` reads scope-signed and uploaded Sale Agreement booleans. Its definition and grants are unchanged; gate-only screen callers do not invoke it in Phase 1.
- Enabled `trg_modules_stage_gate_guard` on `modules`: when a changed `current_stage` maps to H1/H2/H3, reads `projects.project_setup_approved`, raises if false, then requires the matching `gfc_records.status='approved'`. It is unaffected by a code constant. Both restrictions remain active.
- Enabled `trg_sync_project_setup_approval` on `project_setup_approvals`: both independent approved decisions set Setup approved/status; a rejection sets rejected status. With the approval surface hidden and no writes performed, it does nothing for this change.
- Enabled `trg_projects_fire_billing` on `projects`: false→true Setup approval calls `fire_billing_milestone_event(...,'project_setup_approved',...)`. The separate closed-project/handover branch also remains unchanged.
- Public `drawings` policy, public `gfc_records` policy (“GFC records visible after project setup approved”), and storage `objects` drawings-read policy still condition ordinary access on Setup approval, with their existing director/design/planning/operations exceptions. A false Setup flag continues to restrict non-exempt GFC/drawing readers. No RLS or storage policy was changed.

## Gates remaining active

1. **Within `evaluateStageGate`: Gate 4, previous-stage QC** — previous row must be `qc_passed` or `completed`. Its existing behavior when the target/previous row is absent is unchanged.
2. **Kanban immediate-next-stage rule**, stage-close/wastage capture, and existing persistence path.
3. **Database Setup/GFC stage guard**, existing GFC/document access policies and independent drawing-issuance QA.
4. Unrelated dispatch, delivery, dry-assembly, site readiness, photos, attendance, reporting, Rates, Cost and Running Bill controls were not modified.

## Billing while off

The switch neither fires nor disables database billing events. A pending milestone using **Project Setup approved** remains pending while `project_setup_approved` stays false. Hiding the approval card supplies no substitute event. A genuine future false→true approval through an existing authorized path would still fire the unchanged trigger even with the screen switch off. Already-triggered milestones remain as stored. Manual and other configured milestone triggers remain unchanged. The live Test project has no milestone configured with this Setup event; this conclusion is from the live trigger definition, not a fabricated billing write.

## Tests and browser evidence

- Added **46 tests** in three files: `phase-stage-gates.test.ts`, `phase-gates-ui.test.tsx`, `phase-kanban.test.tsx`.
- Tests mock the exported constant true/false, not a database flag. False: zero-gate director legacy upload enabled, both divisions unblocked, no gate-only component reads, H1/H2/H3 evaluator bypass, Kanban drop reaches the unchanged close-stage flow. True: Setup/GFC blocking and gate readers restored. Both: prior QC and next-stage restrictions still block; current workbook file-selection/validation allowed for Planning Head, MD, Finance Director, Sales Director, Architecture Director and Super Admin. No persistence is simulated as a successful real stage write.
- Full suite: **851 passed, 0 failed, 0 skipped, 62 files** using `bunx vitest run --maxWorkers=2`. The first default-concurrency run had 850 passes and one unrelated `parity2b-permission-arrays` 5-second timeout under load; the complete lower-concurrency rerun passed without modifying that test.
- Signed-in real MD browser, actual Test project - 1, unchanged `project_setup_approved=false`, `project_setup_status=not_submitted`, **0/5 Habitainer gates complete** (scope unsigned, no Sale Agreement, E-3/E-5/E-8/P-1 absent). Checklist and Setup Approval counts were zero.
- Real workbook input: one Schedule, one BOQ and one Material Plan row; Validate Workbook returned **no errors**, Commit was enabled. **Commit was not clicked**; no data written. Planning Head and other directors were tested via component role cases, not separate live account sessions. True-mode and stage-drop checks are automated component/domain checks, not a published deployment or real module mutation.
- Signed-in desktop **1280×1800** and mobile **360×800** checked. Project and validated workbook had document width **360**, viewport width **360**, no horizontal overflow. Screenshots of both states inspected. No browser runtime errors; current automatic preview build log: **build OK**.
- Fresh authenticated read of unchanged Running Bill and UI readback: **earned ₹151,000; own labour ₹6,365.46; subcontract ₹0; excess ₹19,500**. Factory labour stayed ₹0. No Running Bill code changed.
- `reminder_events` read-only count remained **0** at initial and final inspection. No reminder event writes or “Fix all” action.

## Release

**Publish > Update** releases the frontend-only switch; it does not remove the preserved database stage restrictions.