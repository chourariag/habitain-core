# BOQ-1 CONFIRM

## Result and publication
Fresh BOQ entry is available in Project → BOQ under the existing Project Setup flag. Database changes are already applied. **Publish > Update** deploys the screen. No baseline/BOQ was finalised permanently on a real project. Existing BOQs remain unchanged and read-only in this new screen.

## INSPECT — existing schema and dependencies
The exact inspected columns, defaults, nullability, constraints, policies and triggers are reproduced in `docs/BOQ1_INSPECT_RAW.md`; final executable SQL is in `drizzle/migrations/0079_boq1_fresh_entry_control_and_lock.sql` and `0080_boq1_workbook_guard_compatibility.sql`.

### Header and lines before this change
- Header `project_boq`: id, project_id, version_number, uploaded_by, uploaded_by_name, uploaded_at, total_boq_value, blended_margin_pct, factory_scope_value, civil_scope_value, created_at, updated_at, gfc_pending_h1, tender_total_value, gfc_total_value.
- Lines `project_boq_items`: id, boq_id, sno, category, item_description, unit, actual_qty, wastage_pct, boq_qty, material_rate, labour_rate, oh_rate, boq_rate, total_amount, margin_pct, scope, procured_qty, created_at, tender_qty, tender_amount, gfc_amount, schedule_task_id, work_location.
- Primary keys: id. Header project_id → projects; lines boq_id → header; schedule_task_id → project_tasks. Existing work_location check permits site/factory. Existing header update timestamp trigger only; no line amount generation trigger or unique item number constraint existed.
- Foreign-key readers: factory_report_quantities, site_report_quantities, project_cost_rates, project_cost_rates_log, subcontract_rates, boq_work_location_log → line id.

### Existing writers and permission sources
- Design Portal `BOQManager`: browser calculates fallback quantity/rate/total and blended margin, creates a new header version and inserts lines. Its visible upload-role list was wider than the actual INSERT policy. Upload and template controls are now hidden by the legacy BOQ switch; existing read display is preserved.
- `ProjectSetupUpload`: legacy direct header/line inserts; already hidden on Project Detail by the existing schedule legacy switch. Code preserved.
- `BudgetTrackingTab`: legacy Tender/GFC upload calculates typed/fallback monetary values in browser; screen already hidden. Code preserved.
- Setup workbook: `commit_project_setup_excel_upload_v2` → `commit_project_setup_excel_upload` → `commit_project_setup_upload_validated` → `commit_project_setup_upload`. It upserts lines by BOQ+sno, maps task_code to schedule_task_id, computes quantity × rate on server, and records setup changes.
- Existing INSERT/UPDATE policy role source: `get_user_role(auth.uid())`, which reads the active `profiles.role`: super_admin, managing_director, finance_director, finance_manager, planning_engineer, architecture_director, project_architect, principal_architect, sales_director.
- Existing workbook writer source: checked `has_role`/Tier 1 helpers against user_roles; planning_head and Tier 1/Super.
- `can_manage_boq` uses active profile role: super_admin, managing_director, head_operations, planning_head, planning_engineer, costing_engineer and the three functional directors. This helper is not identical to the direct table write policy.
- Existing SELECT policies use user_has_any_role/user_roles: super_admin, managing_director, chairman, finance_director, finance_manager, accounts_executive, planning_head, planning_engineer, costing_engineer, quantity_surveyor, architecture_director, principal_architect, project_architect, head_operations, head_of_projects, sales_director.
- Existing DELETE policies allow Tier 1/Super hard deletion. They were not altered; fresh BOQ guards refuse hard deletion and archive through checked actions. No existing record was deleted.
- New BOQ functions use caller-bound user_roles: union of existing direct BOQ writer roles and workbook planning_head; additionally active non-archived profile and user_can_access_project. No role/account or existing RLS policy was changed.

### Reader field contracts — preserved
| Reader | Fields depended on |
|---|---|
| Design BOQManager | Header version_number/uploaded_by_name/uploaded_at/total_boq_value/blended_margin_pct/factory_scope_value/civil_scope_value; lines sno/category/item_description/unit/tender_qty/actual_qty/wastage_pct/boq_qty/material_rate/labour_rate/oh_rate/boq_rate/total_amount/margin_pct/scope/procured_qty |
| Setup status/workbook | Header id/project_id/version_number; lines id/boq_id/sno/item_description/category/unit/boq_qty/boq_rate/schedule_task_id; task code/name join |
| Factory BOQ selectors/report validation | Header id/project_id/version_number/uploaded_at; lines id/boq_id/sno/item_description/unit/work_location; quantity record FK retains line id |
| Site reports | Header latest version; lines id/item_description/unit/boq_qty/boq_rate/schedule_task_id/work_location; quantity and allocation joins retain id |
| Project Rates | Latest header id/project_id/version_number/uploaded_at; line id/boq_id/sno/item_description/unit/work_location; rate tables reference line id |
| Running Bill / get_running_bill | Line id/boq_id/sno/item_description/unit/boq_qty/boq_rate/schedule_task_id; header project_id/latest version; positive-quantity cap unchanged |
| Project Cost / get_cost_report | Line id/boq_id/boq_qty/boq_rate/schedule_task_id; existing submitted quantity and frozen-rate joins unchanged |
| MeasurementSheet (legacy) | Latest header id; selects all line fields; uses category/item_description/unit/boq_qty/material_rate/labour_rate/oh_rate/boq_rate/total_amount/procured_qty and actual/wastage quantities |
| Budget tracking / project P&L | Latest header id; category,total_amount for category budgets and manual/GRN comparisons; tender/GFC header totals for legacy display |
| WorkOrdersTab | Latest header id; line category,total_amount to estimate scope allocation |
| BOQ work-location reader | Line id/sno/item_description/unit/work_location, latest header |
| Archive | Existing archive screen selects all project_boq_items with `.eq('project_id', id)`, although that column does not exist on lines: pre-existing incompatible read, untouched |
| Variations | Separate `boq_items`, not project_boq_items: id/description/unit/boq_rate/project_id/is_archived; project_variations.linked_boq_item_id points to that separate model |

### Computed versus typed
Existing numeric columns are ordinary stored values, not generated columns. Design upload accepts typed tender/actual/wastage/BOQ quantities, cost components, BOQ rate, total and margin; zero fallback derives boq_qty=actual_qty×(1+wastage%), boq_rate=material+labour+OH and total=qty×rate. Budget upload accepts/derives tender_amount=tender_qty×rate and gfc_amount=boq_qty×rate, uses GFC or tender total, and types margin. Workbook computes total on server. These legacy calculations remain in hidden/preserved code only.
New entry types boq_qty and boq_rate; server rounds each product to two decimals, sets tender_qty/tender_amount as compatibility mirrors and header total/tender total/scope totals. It does not invent GFC quantity, GFC amount, cost rates or margin. Header control total must be an exact paise value.

### Variations versus revisions
Variations remain their separate approval workflow and separate legacy BOQ link. A revision corrects this final fresh BOQ's control total/lines atomically with a required reason and old/new audit; it does not create, approve, replace or absorb a Variation. No variation rule or downstream table/function changed.

## SQL, access, locking and entry
- New columns extend the existing header/lines; legacy rows retain entry_mode=legacy and their original monetary values.
- A partial unique index enforces one active fresh header per project; creation refuses any project that already has a BOQ, so existing project lines cannot be replaced by this screen.
- New audit and acknowledgement tables have explicit GRANTs, enabled RLS and project-/role-checked read policies. Authenticated callers have no direct write grant on them.
- Existing header/line RLS unchanged. Fresh-only guards block direct entry/edits/deletes with 42501, require owner-executed checked action context, compute amounts and fill actors/times. Final mutations only through `boq1_mutate(...,'revise',...)` with a reason and exact balance, in one transaction.
- Optimistic entry_version and project/header locks protect concurrent writes.
- Draft invalid pasted rows return per-row errors; valid rows remain reviewable/savable. Duplicate item number is an error. Revisions are all-or-nothing.
- Duplicate description+unit normalises whitespace/case. Outlier lookup uses latest BOQ per other active project, first median per project then median across projects. Strict >25%; nothing below 3 projects. Only median/count warning fields returned, no other project id/name or line data.
- Zero/missing quantities/rates and rate precision warnings are nonblocking. Acknowledgement saves warning fingerprint, note, actor/time and an audit entry.
- Removal is archival, not deletion. New entry rows are neutralised to zero quantity/rate/amount on removal so unmodified downstream readers that do not filter is_archived cannot count removed budget values; old values stay in the audit. Existing legacy rows never use this action.
- BOQ_LEGACY_UPLOAD_VISIBLE=false hides BOQ in the workbook template/upload preview and ignores BOQ sheets with a clear message. Every server workbook entry point refuses nonempty BOQ rows. Material Plan and Subcontract Rates remain on their existing paths; fresh header totals are not rewritten by the legacy wrapper.
- No fresh BOQ template, copy or rate autofill; Download BOQ exports the current project only. Client TSV paste supports quoted tabs/newlines and positional column mapping; 500-row/2MB limits explicit.

## Real-account rollback evidence
Karthik (planning@altree.in, planning_engineer), auth.uid bound with SET LOCAL ROLE authenticated on Test project - 1. Vincent (prod.dbr5@altree.in) denied as non-writer. Temporary project membership and NEW header/lines only; existing lines untouched. Three NEW comparison projects were necessary because only two active projects existed. Final intentional `BOQ1_ROLLBACK_OK` exception rolled back all fixtures.
- (a) Server preview/save of 12 lines: duplicated description warning; 130 versus median 100 across 3 projects gives outlier warning; sum ₹1,230.00.
- (b) ₹1,231.00 control: ₹1.00 difference refuses Finalise.
- (c) ₹1,230.00 control finalises with server final_by/time; direct header/line edit both refused 42501.
- (d) No reason refused; unbalanced reasoned revision refused; quantity 1→2 plus control ₹1,330.00 accepted, audit verifies old/new, actor and reason.
- (e) Vincent refused 42501.
- (f) Preview has median/count only; no project identity fields or comparison-project names.
- (g) NaN/negative row values return errors; NaN/negative control and fractional paise control refused.
- (h) Workbook v2 with BOQ rows refused 42501 with clear BOQ-sheet-off message.
- Warning acknowledgement verified persisted audit and actor inside rollback.
- Fresh headers/comparison projects/fixture lines/access all read back as **zero** after rollback.
- Reusable fuller harness: `src/test/boq1-entry.rollback.sql` (includes stale-version assertion).

## Screenshots and browser checks
Screenshots stored in `docs/boq1-evidence/`: entry1440.png, entry1024.png, entry390.png, refused1440.png. Signed in as Gaurav, confirmed actual existing BOQ read first. Fresh warning views use a mocked READ response only; no fixture saved permanently. Browser refused save was a REAL request against the actual legacy test project: returned “Save the control total and source note before entering lines”; row stayed open, inline error visible, no success. No page errors. Document scrollWidth exactly 1440/1024/390; phone has zero entry inputs.

## Tests and unverified items
- Full suite **989 passed / 73 files** (984 previous + 5 paste tests); first high-parallelism run had two unrelated 5-second timeouts, rerun with maxWorkers=2 passed all. Final focused tests 23/23 passed. Preview build OK.
- Successful fresh create/save/finalise/revise end-to-end through a real browser remains **unverified**: existing test project has legacy lines that must not be edited, and all new fixtures had to roll back. Real roles/database path covered; screenshots honestly use mocked fresh reads.
- Material Plan/Subcontract Rates successful post-change browser upload not exercised; existing tests pass and original writer bodies retained, with fresh header update excluded.
- Full live downstream financial/report recalculation not executed; interfaces and rules preserved and suite passes.
- Rates with >2 decimals, zero/missing warnings and fewer-than-three/25%-boundary median cases are implemented but not all individually exercised in the live rollback matrix.
- Existing archive project_id mismatch and legacy hard-delete policies are pre-existing, untouched.

The in-app spreadsheet-import skill shaped paste parsing, positional mapping, full counts, per-row validation and reviewed submission.
