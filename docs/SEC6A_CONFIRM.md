# SEC-6a CONFIRM — 22/11/2026

## Scope and outcome

Migration **0065** applied. Three independently reversible tightenings: advance self-action trigger; portal token generation/validation; export/print adapters. No changes to existing RLS policies, roles/accounts, feature flag values, schedules, reminders, storage/photo paths or correction notifications. Report calculation code is unchanged; report file imports change solely to apply the requested export protection. Nothing was automatically fixed or suppressed in the scanner.

**942 tests passed, 0 failed, 0 skipped, 65 files.** Build log latest entry: build OK. SQL rollback checks passed (tool returned success), using 31 existing active principals: 6 allowed different-request approvers, 25 denied, 4 multi-role principals. No persistent test advances/tokens or reminder writes. Running Bill unchanged: earned ₹151,000; own labour ₹6,365.46; subcontract ₹0; excess ₹19,500.

## (a) Advances

Inspected AdvanceManagement, AdvanceApprovalsTab, AdvanceRequest and database policies/functions/triggers. Only advance_requests was found; the detailed site/subcontractor form and generic finance form share that table. No separate salary/vendor approval path was established, so no permissions were inferred or widened.

Existing database approvers remain: **super_admin, managing_director, finance_director, sales_director, architecture_director, finance_manager**. The approval-screen role list remains the five built-in leadership roles; its Finance Director/MD wording was already narrower than the list. site_installation_mgr retains own pending insertion/read only. No type-specific role differentiation was proven, so the same existing table permissions remain for all advance types. Multiple roles do not bypass requester exclusion.

sec6a_advance_guard() runs BEFORE INSERT/UPDATE. requested_by is captured from the caller; requester/employee identity cannot be replaced. Requester/employee auth identity cannot approve, release or mark paid, including metadata-only transitions or forged already-approved inserts. Function execution revoked from PUBLIC/anon/authenticated; only the trigger invokes it. Example rolled back: each principal inserted a pending own request, then attempted approved/approved_by, released/released_by and paid; each self-action raised 42501 (or policy denied it), while a different allowed approver changed exactly one row. The four existing multi-role principals were included. Existing policy definitions were retained.

## (b) Portal links

Before: project links used Math.random() for 32 characters and usually a 30-day expiry; nullable expiry allowed unlimited lifetime. Per-client links used random UUIDs with nullable expiry and is_active revocation. Both project readers returned full project rows. Existing project association was checked, but new links now use one private resolver shared by the narrowed root/design readers.

New credentials: **32 cryptographically random bytes encoded as 64 hex characters**, generated in database triggers. Default **90 days**, configurable positive days per link. Existing token values and expiry are untouched. Project revocation sets enabled=false; per-client revocation sets is_active=false. Per-client identity/project changes are rejected. Existing expired/null-expiry links are not silently regenerated.

manage_project_portal_link(uuid,text,integer) checks Tier 1/Super, SECURITY DEFINER, search_path=public, PUBLIC/anon revoked, authenticated EXECUTE granted. This preserves the intersection of the old legacy-project screen managers and effective projects UPDATE policy. Planning Head still manages/revokes per-client links through unchanged client_portal_tokens policies (leadership + planning_head); it never had effective legacy-project UPDATE access. site_installation_mgr remains visible under the existing screen list but existing server policies do not allow link mutations; this discrepancy was left unchanged, not widened.

sec6a_client_token_guard(), sec6a_legacy_token_guard() are trigger-only, no client execution. resolve_client_portal_token(text) has no PUBLIC/anon/authenticated execution. get_project_by_any_portal_token(text) and get_project_by_portal_token(text) allow anon/authenticated EXECUTE, PUBLIC revoked, and return only id/name/client_name/division/start_date/status/legacy expiry/status message. Legacy UUID reader remains compatible and does not disclose client email. Design reader uses the exact token's resolved project. Tests cover default/configured expiry, valid/expired/revoked/public/invalid tokens and cross-project root reads.

**Existing live links: 0.** Existing records preserved: Pebble Beach House legacy link, project created 24/06/2026, expiry 03/10/2026, enabled but expired. Five per-client links for that project, created 03/09/2026 (four) and 04/09/2026 (one), null expiry and inactive. No shared active link invalidated.

Limitations left unchanged: ClientPortal references expected_handover_date, but that column does not exist in projects; its previous UI value was already blank. get_billing_milestones_by_portal_token is not deployed; the existing fallback remains. Child portal screens use existing direct table reads and policies; no broader child permission rewrite was attempted, and a full valid-link public browser flow was not verified. Root token project-scoping and expiry/revocation were verified in rollback SQL and component tests. No claims are made that all underlying child-table access is newly token-scoped.

## (c) Export and print inventory

One neutralizeCell implementation in functions/_shared/export-safety.ts, re-exported by src/lib/export-safety.ts. safeCsvCell handles quoting; safe-xlsx wraps SheetJS generated sheets/writes; safe-exceljs handles ExcelJS string cells. Numbers remain numbers and deliberate formula cells remain formulas; columns/headings/order/calculations unchanged.

CSV writers changed: EmployeeManagement.downloadCsv; RevenueMarginTab.exportCsv; ReceivablesTab.exportCsv; PaymentsTab export; QuotationsTab quote-template download; DeliveryTrackerTab.exportCsv; CreateAccountsTab, BulkCreateAccountsDialog and AccountCredentials credentials downloads; nightly export-utils.csvCell for every manifest file, including expenses and site_readiness_crane_v1. export-latest only serves files, with no writer. Existing latest files are not rewritten until their normal next export.

SheetJS writers now share safe-xlsx: expense-excel, super-admin, xlsx-templates, cost-rates, cost-report; ExpensesTab, ProfitLossTab, LabourPage, ContractsRegisterTab, FactoryCostCard, BudgetTrackingTab, DelayDashboard, ProjectSetupWorkbook, RunningBillStatement, SiteScheduleSection, ProjectCostRates, ProjectCostReport, InstallationSequenceDoc and RolePermissionsTab. ExcelJS final writeBuffer hardening: ManpowerWeeklyExcel, ProjectSetupUpload, DesignScheduleUpload. Imports/reader behavior are otherwise unchanged.

Print inventory: BoardPaperDraft document.write consumes generate-board-paper HTML; dynamic input strings are now recursively HTML-escaped at the generator. Management window.print uses React-rendered DOM (already escaped). jsPDF outputs are not interpolated HTML. Deployed generate-board-paper and export-nightly.

| Before string | After string |
|---|---|
| =SUM(1+1) | '=SUM(1+1) |
| +cmd | '+cmd |
| -2+3 | '-2+3 |
| @A1 | '@A1 |
| leading tab / carriage return | single quote before original character |

15 focused helper tests cover strings, quoting, numeric/formula preservation, SheetJS/ExcelJS and HTML. A real component download Blob test reads all four hostile strings back neutralized and preserves numeric delay. Deployed print function returned 200 for script/image test strings; rendered output contained escaped text and zero script/image nodes.

## Role and browser evidence

Existing menu/Daily Report matrix: 43 tests, includes site_engineer, site_installation_mgr, factory_floor_supervisor, finance_manager, head_of_projects, planning_head, quantity_surveyor, costing_engineer, all four Tier 1 roles and super_admin. New portal/UI suite: 51 tests (13 role labels × valid/expired/revoked, five leadership roles × self-error/different-request success, manager lifetime and download readback). Role labels in component tests do not mint real accounts; live SQL uses actual user_roles identities, including 4 dual-role users.

Requested roles without an active effective role account: site_installation_mgr, factory_floor_supervisor, quantity_surveyor; component-tested only, not invented or seeded. Other existing accounts' effective roles were tested in SQL. Signed-in MD browser: selected Test project Daily Report loaded with real tasks, 360px no horizontal overflow, zero runtime errors. Invalid portal link refused in the live browser. Finance route redirected to Home under existing module/route guard; no flags changed to bypass it, so live approval screen remains unverified (component/SQL checked). Normal menu and report component tests show no changed access; intentional changes are self-action rejection, finite stronger new links, and hostile spreadsheet/HTML text serialization.

## Full latest open scan inventory

Latest result: **20 deep + 8 database/storage = 28 open findings**; app/deep-app/supply-chain scans returned no additional findings. Initial prior deep inventory was superseded by the completed scan. Scanner records still show the scoped issues open; code/SQL evidence verifies mitigation but no scanner closure is claimed. Outside-scope items remain unchanged; legitimate audience is not assumed when evidence is insufficient. “error” is Critical, “warn” Warning, “info” Informational as reported.

| ID | Severity | Finding / access today | Legitimate need / disposition |
|---|---|---|---|
| `lov_finding_0b943fdea6e5d11e` | Critical | Anyone can guess client portal links; `projects.client_portal_token` | Scoped mitigation verified; scanner still open. Intended audience retains normal actions, never self-action or injected formulas/scripts. |
| `lov_finding_0f32d69f370ebec9` | Warning | Any workspace member can place formulas in delivery exports; `material_delivery_tracker CSV download` | Scoped mitigation verified; scanner still open. Intended audience retains normal actions, never self-action or injected formulas/scripts. |
| `lov_finding_19426edc43a7ef8c` | Critical | Anyone can sign in to staff accounts with the shared password; `Staff-account password migration (20260622064019)` | Only the account owner should sign in; historical-password finding not independently verified or changed here. |
| `lov_finding_300b6886372bdc71` | Warning | Anyone can map attachment stages to projects; `public.attachment_entity_project(text,uuid)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_47c516bf79325c89` | Warning | Any site engineer can place formulas in crane booking exports; `site_readiness_crane_v1.csv` | Scoped mitigation verified; scanner still open. Intended audience retains normal actions, never self-action or injected formulas/scripts. |
| `lov_finding_540dda6c5ae138d8` | Critical | Authorized project members can email arbitrary people; `supabase/functions/send-calendar-invite (send-calendar-invite action)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_5c949f85107572ca` | Critical | Any site installation manager can approve their own cash advance; `public.advance_requests` | Scoped mitigation verified; scanner still open. Intended audience retains normal actions, never self-action or injected formulas/scripts. |
| `lov_finding_5f5a7b2a49747c5f` | Warning | Anyone can check who can bypass photo requirements; `public.can_attendance_photo_exception(uuid)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_6d8d7666d9c56eff` | Warning | Anyone can probe staff salary access; `public.can_access_labour_compensation(uuid)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_786e75ea057dc791` | Warning | Any director can keep a project archive link for a year | Directors need exports; intended maximum lifetime not changed in this scope. |
| `lov_finding_8074893a1aecd526` | Warning | Anyone can map design stages to projects; `public.attachment_entity_project(text,uuid)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_84a6008fd9ebe35f` | Warning | Any signed-in user can check who can approve requests; `public.can_approve_request(uuid,approval_requests)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_8d969d5a1714bdac` | Warning | Authenticated users can read other projects' measured quantities; `function public.boq_cumulative_qty(uuid)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_9c3b40ae97011642` | Critical | Any site installation manager can approve their own cash advance; `public.advance_requests` | Scoped mitigation verified; scanner still open. Intended audience retains normal actions, never self-action or injected formulas/scripts. |
| `lov_finding_9fa682981c91e76c` | Warning | Any director can execute script through board-paper printouts; `BoardPaperDraft PDF print window` | Scoped mitigation verified; scanner still open. Intended audience retains normal actions, never self-action or injected formulas/scripts. |
| `lov_finding_bf4a7584bc12d5e8` | Warning | Any signed-in user can identify subcontractor access holders; `public.can_access_subcontractors(uuid)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_d12825ce1bbbcd75` | Critical | Anyone can sign in to every account with the shared password; `Global auth-user password migration (20260622070130)` | Only the account owner should sign in; historical-password finding not independently verified or changed here. |
| `lov_finding_d44555423de275fa` | Warning | Any signed-in user can identify asset-disposal approvers; `public.can_approve_asset_disposal(uuid)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_f07e3736813ff121` | Warning | Anyone can identify quotation approvers; `public.can_approve_quotations(uuid)` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_finding_f0a79d83c6600686` | Warning | Any signed-in user can place formulas in expense exports; `expense_entries_v1.csv scheduled export` | Scoped mitigation verified; scanner still open. Intended audience retains normal actions, never self-action or injected formulas/scripts. |
| `lov_db_rls_authenticated_only_v1_89d7ce56a8a7bb9b` | Informational | Any signed-in user can read every record in feature_flags; `Policy "Authenticated users can read feature flags" on table public.feature_flags` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_db_rls_tautology_permissive_v1_73dcdffb7e5d900e` | Informational | Any signed-in user can read every record in this table; `Policy "All authenticated can view stage defs" on table public.design_stage_definitions` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_db_rls_tautology_permissive_v1_8f5b1ff9fcddd553` | Warning | Any signed-in user can read every record in announcements; `Policy "Authenticated can view announcements" on table public.announcements` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_db_rls_tautology_permissive_v1_bc45944cc18c8141` | Warning | Any signed-in user can read every record in kpi_definitions; `Policy "All authenticated read kpi_definitions" on table public.kpi_definitions` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_db_rls_tautology_permissive_v1_e0bed52c12847a24` | Informational | Any signed-in user can read every record in this table; `Policy "All authenticated can read QC SOP definitions" on table public.qc_checklist_definitions` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_db_storage_objects_owner_unbound_v1_468a2c75b5ab2735` | Warning | A rule lets any signed-in user download files in drawings; `Policy "Authenticated can view drawings" on storage.objects` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_db_storage_objects_owner_unbound_v1_b625fe1ddf634b19` | Warning | A rule lets any signed-in user download files in design-files; `Policy "Authenticated read design stage files" on storage.objects` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |
| `lov_db_storage_objects_owner_unbound_v1_bb23ff90a5e6dfb0` | Warning | A rule lets any signed-in user download files in design-files; `Policy "Authenticated read sale agreements" on storage.objects` | Unchanged: outside SEC-6a; legitimate grants not established here. Separate review required. |

The scan covers the requested portal finding, both duplicate self-approval findings, and export/print findings (delivery, crane, expense nightly and board paper). All other findings remain because account changes, role probes, quantities, email boundaries and storage policy changes were outside this authorization. Neither scanner findings nor permission policies were suppressed. Evidence is tests/rollback/print readback, not a clean rescan claim.

**Next: Publish > Update.**
