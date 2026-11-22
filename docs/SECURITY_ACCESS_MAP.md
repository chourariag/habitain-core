# SECURITY-1 Access Map

## SEC-6a — 0065

Advance self-actions are blocked by a trigger with caller-bound requester identity; existing approver policies unchanged. New portal links are 32-byte cryptographic secrets, 90-day configurable expiry, revocable, with legacy tokens preserved and safe root projection. Legacy project management RPC is Tier 1/Super; per-client management keeps existing leadership/Planning Head policies. Private resolver is not client-executable; public checked root readers expose only portal fields. Spreadsheet/CSV writers use shared neutralization and board-paper dynamic HTML is escaped. Full grants, complete 28-finding inventory, scope limitations and 942-test evidence: [SEC6A_CONFIRM.md](SEC6A_CONFIRM.md).

## PROJ-LOC cleanup — 0064

- Zero rows in `project_client_contact_requests` at inspection and cleanup. Table deletion is blocked by the platform; the private table is retained, explicitly deprecated, with unchanged RLS and no client grants. No app reader/writer remains.
- Removed `raise_project_request(jsonb,text,text)` and `get_project_request_client_contact(uuid)` and the Approvals pending-contact display. `approve_project_request(uuid)` keeps its existing authorization, decision, ownership and status-audit behavior but no longer reads/copies/clears staging. Existing approval records are untouched; its payload still excludes contact through the existing guard.
- `create_project(jsonb,text,text)` already writes validated phone/email directly to projects for every entitled caller, including explicitly granted non-directors. Its implementation and the New Project call remain unchanged.
- `get_project_client_contact`, director-only `set_project_client_contact`, site location/editing, attendance and safe export/list projections remain unchanged. Historical PROJ-LOC/PROJ-ACCESS sections below describe behavior before this cleanup.

## PROJ-ACCESS — 0063

- `project_creators`: RLS on, no client policies or PUBLIC/anon/authenticated table grants; service role has full access. Explicit grant rows are soft-revoked and audited in the existing `super_admin_audit_log`. Built-in Tier 1/Super principals are never seeded.
- `can_create_project(uuid)` is STABLE SECURITY DEFINER, `search_path=public`, authenticated execution only (PUBLIC/anon revoked). Requires an active non-archived profile plus caller-bound `user_roles` Tier 1/Super entitlement or an active explicit grant.
- `list_project_creators()`, `grant_project_creator(uuid,text)`, `revoke_project_creator(uuid)` check active Tier 1/Super caller internally. The list supplies safe names/role arrays, built-in markers, grant attribution/status and active candidates; no account/contact secrets. Grant/revoke cannot change the built-in group or roles/accounts. All are SECURITY DEFINER, `search_path=public`, PUBLIC/anon revoked, authenticated execution granted; list is STABLE.
- Only projects INSERT policy changes to `can_create_project(auth.uid())`; existing projects UPDATE/DELETE and all child-table policies are untouched. `create_project(jsonb,text,text)` checks the authenticated caller, accepts fixed creation fields, validates existing site/contact/WO requirements, and atomically creates project/modules/stages/panels. Generated project type stays generated; private client contact returns no values. PUBLIC/anon revoked, authenticated execution granted.
- Legacy `approve_project_request` and `raise_project_request` now require the creation entitlement before their existing behavior, so their SECURITY DEFINER paths cannot bypass the new restriction. Pending requests are untouched. Allowed new creators bypass approval entirely via `create_project`; old approval readers/decision rules remain.
- New Project visibility calls the server helper, not a hardcoded role list. Project Creators tab uses only checked RPCs and requires Tier 1/Super. Existing Role Permissions, Phase 1 gates, Setup, reports, rates, costs, flags, jobs and reminders are unchanged.

## Phase 1 gates off — frontend only

`PREPROD_GATES_ENFORCED=false` in `src/lib/phase-flags.ts` hides the pre-production checklist, Setup Approval, Factory Floor warning and GFC Setup deadline; skips their gate-only reads; and bypasses legacy Setup upload blocking plus Kanban Project Setup/H1/H2/H3 locks and requirement labels. Set true to restore the original layer. Previous-stage QC and immediate-next-stage movement stay enforced. Current workbook uploader roles and the `project_setup` module flag are untouched. No database, policies, grants, triggers, stored approval/status data, schedules or reminders change. Billing events remain server-driven: a pending `project_setup_approved` milestone does not automatically fire while the stored flag stays false.

Live inspection also found the enabled `trg_modules_stage_gate_guard` on modules and Setup-dependent GFC/drawing/storage read policies. These cannot follow a frontend constant and remain enforced. The user explicitly confirmed frontend-only scope after this limitation was reported. The switch restores/bypasses the screen layer only, not database stage restrictions. Full evidence: `docs/PHASE1_GATES_OFF_CONFIRM.md`.

## PROJ-LOC — 0058–0062

- `get_project_client_contact(uuid)` and `get_project_request_client_contact(uuid)` are STABLE SECURITY DEFINER, `search_path=public`, PUBLIC/anon revoked, authenticated execution granted; only `is_tier1_or_super(auth.uid())` can receive contact rows. Other authenticated callers receive no row.
- `raise_project_request(jsonb,text,text)` checks the existing creation roles (Planning Head or Tier 1/Super) against caller-bound `user_roles`. It atomically writes a whitelisted contact-free approval payload and private contact staging. Requesters may write but cannot read staged contact. `approve_project_request(uuid)` locks the pending request, uses unchanged `can_approve_request`, rejects self/double approval, copies contact into projects and clears/archives staging in one transaction. The existing generated project type remains database-derived.
- `set_project_client_contact(uuid,text,text)` is director/Super-only; `set_project_site_location(uuid,text,numeric,numeric,integer)` additionally permits Head of Projects. Both are SECURITY DEFINER, `search_path=public`, PUBLIC/anon revoked, authenticated execution granted. Validation occurs inside the writers. Audits never include phone/email values.
- `project_client_contact_requests` and `project_location_contact_log`: RLS enabled, zero client policies, all anon/authenticated direct grants explicitly revoked; service role retains full grants. No existing-table RLS policy changed. Contact staging is cleared and archived, not hard-deleted.
- The broad projects SELECT grant found at inspection was removed; all non-private columns retain explicit authenticated SELECT. Phone/email and portal credentials are excluded. Project screens use an explicit safe projection; directors retrieve contact separately. Archive output strips project contact and portal credentials. Nightly export manifest is unchanged and excludes contact.
- `_require_project_site_location` gates employee site check-in inserts/location changes, `save_labour_attendance` and `add_attendance_photo`. Existing distance thresholds, configured radius use, warning/manual exceptions, photos and hours rules are unchanged for configured projects. All new internal helpers and trigger functions have PUBLIC/anon/authenticated execution revoked.
- The legacy portal-token reader was inspected and ultimately preserved: its email belongs to separately entered `client_portal_tokens`, not `projects`; no new-project contact is copied there. ClientPortalManager retains its separate token workflow.
- A create-project-only payload trigger rejects phone/email keys, including nested ones, without changing other approval types or existing RLS policies.
- No feature flags, cron schedules, reminders, user roles/accounts, storage policies, Setup upload, BOQ, Running Bill, Daily/Factory report, Rates or Cost report changes.

## Project Cost — 0056

- `get_cost_report(uuid,date,date)` is STABLE SECURITY DEFINER with `search_path=public`, authenticated-only execution, PUBLIC/anon revoked, and an internal `can_view_running_bill(auth.uid())` check.
- Submitted non-archived site/factory reports only. Existing Running Bill and factory labour rules are reused; value earned/excess come from unchanged `get_running_bill`.
- Per-person `amount` keys are omitted unless `can_access_labour_compensation(auth.uid())` passes. Factory unallocated aggregate is returned only when `can_view_factory_cost` passes and never added to project cost.
- Frozen material fields are read, never recomputed or written. Missing rates and uncaptured legacy rows are separate counts. Zero captured amount with missing=false identifies includes-material snapshots without depending on a later-edited subcontract flag.
- No new tables, policies, direct column grants, report writers, rates changes, nightly-export data, feature values, schedules or account changes. Project Cost navigation/content share the existing `project_setup` flag.

## Project Rates — 0053–0055

- `project_cost_rates` and `project_cost_rates_log`: RLS enabled, no authenticated/anonymous direct grants or policies; service role has full access. No existing policy changed.
- Checked authenticated-only RPCs: `get_cost_rates`, `set_material_rate`, `upsert_subcontract_rate`, `deactivate_subcontract_rate`, `validate_cost_rates_upload`, `apply_cost_rates_upload`. All SECURITY DEFINER with `search_path=public`; PUBLIC/anon execution revoked. Read/validation functions are STABLE. Caller is always `auth.uid()` and must pass `can_view_running_bill`.
- Private helpers `_cost_require_project`, `_validate_cost_subcontract`, `_cost_rate_log`, `_snapshot_report_material` have no PUBLIC, anon or authenticated execution grants. Audit triggers record material/subcontract changes made by both Setup and Rates; no Setup writer was changed.
- `subcontract_rates.includes_material` defaults false. Its commercial direct table SELECT grant was replaced by the explicit safe metadata column list, without changing RLS; commercial readers use checked RPCs. `get_subcontract_rates` now uses the existing Running Bill commercial gate; Daily Report metadata/validation remains available through its existing safe reader.
- Both quantity tables add `material_rate_used`, `material_amount_inr`, `material_rate_missing`, with no direct authenticated/anon SELECT grants. Site and factory checked readers omit material keys entirely when the caller cannot view Running Bill. No report-screen code changed.
- Submit captures the current material rate once, zero amount when the matching active contractor includes material, and zero amount/missing=true when no material rate exists. Existing submitted rows stay NULL; later edits/rate changes preserve captured rates and amounts. Existing billing/subcontract/attendance calculations remain unchanged.
- Rates tab uses existing `project_setup` flag, without changing its value. Excel key is project+sno on latest `project_boq` version, with read-only description/unit/location checked server-side and version checked again at Confirm. Inactive rates remain inactive on import.
- No material cost columns, rates or new tables were added to nightly exports. No flags, cron, schedules, reminders, roles or accounts changed.

## Live inspection

Inspected live public policies, active profile role coverage, storage bucket configuration, scanner findings and source references. Migration 0033 applied: 11 mapped open policies scoped and backed up; WIP isolated. No account, role, flag, scheduler, or storage configuration changes.

47 policies allow all authenticated users to SELECT. No unconditional authenticated INSERT/UPDATE/DELETE policy was found. Two UPDATE WITH CHECK=true clauses have narrower USING gates (project_archives and site_schedules); these are not open writes and remain unchanged. Service-role-only policies are excluded.

## Mapping counts

| Group | Requested tables | Open policies eligible |
|---|---:|---:|
| Project delivery | 9 | 8 |
| Quality and safety | 6 | 1 |
| Sales and AMC | 4 | 1 |
| Rates and thresholds | 5 | 1 |
| Labour approvals | 1 | 0 |
| Open by design | 2 | 1 |

## Full open-policy list

| Table | Policy | Command | Exact row count | Group |
|---|---|---|---:|---|
| announcements | Authenticated can view announcements | SELECT | 0 | UNMAPPED |
| approval_thresholds | Auth read thresholds | SELECT | 9 | Rates and thresholds |
| client_milestone_photos | Authenticated can view milestone photos | SELECT | 0 | UNMAPPED |
| construction_journal | Authenticated can view journal entries | SELECT | 0 | UNMAPPED |
| depreciation_block_reference | Staff can view depreciation blocks | SELECT | 9 | UNMAPPED |
| design_stage_definitions | All authenticated can view stage defs | SELECT | 60 | UNMAPPED |
| design_stage_history | All authed view design stage history | SELECT | 0 | UNMAPPED |
| dispatch_log | Authenticated users can read dispatch_log | SELECT | 0 | UNMAPPED |
| dispatch_material_log | Authenticated can view dispatch_material_log | SELECT | 0 | UNMAPPED |
| dispatch_signoffs | Authenticated can view dispatch_signoffs | SELECT | 0 | UNMAPPED |
| feature_flags | Authenticated users can read feature flags | SELECT | 36 | UNMAPPED |
| installation_checklist | Authenticated users can read installation_checklist | SELECT | 0 | UNMAPPED |
| inventory_items | Authenticated users can view inventory items | SELECT | 0 | UNMAPPED |
| kickoff_meetings | Authenticated can view kickoff_meetings | SELECT | 1 | UNMAPPED |
| kpi_definitions | All authenticated read kpi_definitions | SELECT | 69 | UNMAPPED |
| manpower_plan_entries | mp_entries_read | SELECT | 0 | Project delivery |
| manpower_plans | manpower_plans_read | SELECT | 0 | Project delivery |
| manpower_subcontractor_plan | mp_subs_read | SELECT | 0 | Project delivery |
| material_alerts | Authenticated users can view material alerts | SELECT | 0 | UNMAPPED |
| module_schedule | Authenticated can view module_schedule | SELECT | 0 | UNMAPPED |
| panel_batches | Authenticated can view panel batches | SELECT | 0 | UNMAPPED |
| panel_handovers | Authenticated can view panel handovers | SELECT | 0 | UNMAPPED |
| panels | Authenticated can view panels | SELECT | 0 | Project delivery |
| payment_approvals | Authenticated users can view payment approvals | SELECT | 0 | UNMAPPED |
| production_stages | Authenticated can view stages | SELECT | 55 | Project delivery |
| production_task_templates | Authenticated users can view task templates | SELECT | 475 | UNMAPPED |
| project_backfills | Authenticated can view backfills | SELECT | 1 | UNMAPPED |
| project_material_plan_items | Authenticated users can view material plan items | SELECT | 320 | UNMAPPED |
| project_material_plans | Authenticated users can view material plans | SELECT | 7 | UNMAPPED |
| project_progress_matrix | auth read ppm | SELECT | 0 | Project delivery |
| project_scope_exclusions | Authenticated users can view exclusions | SELECT | 14 | UNMAPPED |
| project_scope_items | Authenticated users can view scope items | SELECT | 82 | Project delivery |
| project_subtasks | Authenticated users can view subtasks | SELECT | 0 | UNMAPPED |
| project_task_schedule_uploads | Authenticated users can view schedule uploads | SELECT | 0 | UNMAPPED |
| qc_checklist_definitions | All authenticated can read QC SOP definitions | SELECT | 336 | UNMAPPED |
| qc_checklist_items | Authenticated can view checklist | SELECT | 0 | Quality and safety |
| red_flag_alerts | Authenticated users can view red flags | SELECT | 0 | UNMAPPED |
| role_feature_access | Authenticated read role access | SELECT | 12 | Open by design |
| sales_amc_contacts | Authenticated can view sales_amc_contacts | SELECT | 0 | Sales and AMC |
| sales_stage_history | Authenticated can view sales_stage_history | SELECT | 0 | UNMAPPED |
| site_readiness | Authenticated users can read site_readiness | SELECT | 3 | UNMAPPED |
| site_receipt_checklist | Authenticated users can view site receipt checklists | SELECT | 0 | UNMAPPED |
| stage_wastage | Authenticated can view stage wastage | SELECT | 0 | UNMAPPED |
| stores_inventory | Authenticated can view stores_inventory | SELECT | 0 | UNMAPPED |
| subcontractor_schedules | Authenticated users can view subcontractor schedules | SELECT | 0 | Project delivery |
| task_benchmarks | Authenticated users can view benchmarks | SELECT | 0 | UNMAPPED |
| weekly_report_configs | Configs viewable by everyone authenticated | SELECT | 5 | UNMAPPED |

## UNMAPPED — do not change

announcements, client_milestone_photos, construction_journal, depreciation_block_reference, design_stage_definitions, design_stage_history, dispatch_log, dispatch_material_log, dispatch_signoffs, feature_flags, installation_checklist, inventory_items, kickoff_meetings, kpi_definitions, material_alerts, module_schedule, panel_batches, panel_handovers, payment_approvals, production_task_templates, project_backfills, project_material_plan_items, project_material_plans, project_scope_exclusions, project_subtasks, project_task_schedule_uploads, qc_checklist_definitions, red_flag_alerts, sales_stage_history, site_readiness, site_receipt_checklist, stage_wastage, stores_inventory, task_benchmarks, weekly_report_configs

Mapped tables without an open policy are not candidates for a policy replacement; their existing narrower policies remain intact.

## Reader groups

- Project delivery: Tier 1/super; planning_head, planning_engineer, head_of_projects, production_head, head_operations; project membership where project_id exists.
- Quality/safety: Tier 1/super; qc_inspector, head_of_projects, production_head, planning_head; project members.
- Sales/AMC: Tier 1/super; sales_executive, sales_associate, delivery_rm_lead; marketing only contacts/clients; finance_manager only contracts.
- Rates/thresholds: Tier 1/super; finance_manager, costing_engineer, quantity_surveyor, planning_head; procurement_assistant/purchase_assistant only rate_cards/material_rate_benchmarks.
- Labour approvals: Tier 1/super; finance_manager, hr_executive, head_of_projects.

## Safety-check resolution

User approved synthetic checks for sales_associate, quantity_surveyor and procurement_assistant. Migration 0033 ran 22 role subjects × 11 tables before and after, aborted on lost group-reader visibility or control gains, and restored temporary helper substitutes byte-for-byte before commit. No account or role rows changed. Three synthetic subjects are not real-user tests.

## site-photos

storage.buckets.public = false. Already private; no bucket change required. Existing helper src/lib/storage-signed-url.ts defaults to 3600 seconds and handles stored paths plus legacy URLs. Signed-in MD screenshot confirmed all 10 existing Pebble Beach House site-readiness photos loaded.

### Public-link source references (unchanged because bucket was already private)

- src/components/dispatch/DispatchPackFormV2.tsx:108
- src/pages/DesignPortal.tsx:377
- src/pages/Drawings.tsx:271
- src/pages/Profile.tsx:114
- src/components/production/SupervisorDailyLog.tsx:89
- src/components/site/SiteReceiptChecklist.tsx:68
- src/components/site/SiteFactoryFeedback.tsx:85
- src/components/site/SiteDiary.tsx:126
- src/components/site/PunchListModule.tsx:76
- src/components/site/GuidedPhotoCapture.tsx:102
- src/components/site/HandoverPack.tsx:111
- src/components/site/InstallationChecklist.tsx:88
- src/components/drawings/ModuleDrawingsTab.tsx:100
- src/pages/DispatchPackForm.tsx:89 (dynamic bucket can be site-photos)
- src/lib/expense-policy.ts:65 recognizes legacy /object/public/site-photos URLs and signs them (existing 300-second legacy-receipt expiry).

No public-to-private transition occurred, so these legacy upload paths were not changed; existing site-readiness uses 3600-second signed URLs. Converting all legacy persistence/rendering paths remains outside the conditional change made here.

## WIP dependency inventory

- Explicit application read: src/components/production/FactoryMeasurementSheet.tsx:74 (also writes total_wip_today at line 201).
- Export manifest: supabase/functions/_shared/export-schema.ts:169,181,185; consumed by supabase/functions/export-nightly/index.ts:41.
- Generated declarations: src/integrations/supabase/types.ts (not a runtime reader).
- Live SQL readers/writers: apply_record_edit and submit_site_report. The former updates review flags and recalculates totals; the latter writes totals/review flags during submission.
- Runtime explicit read/export path: 3 files, under the five-file threshold. WIP moved to daily_measurement_wip; 3 rows backfilled. Old columns retained as 0/false/null to prevent leaks. submit_site_report and apply_record_edit now write private WIP; factory writer uses checked save_factory_measurement_wip. Export-nightly joins private WIP server-side and was deployed/tested successfully without CSV header changes.

## Active scanner findings

52 baseline database findings; zero dependency findings returned. Platform-mandated automatic remediation marked the three listed auto-fix findings resolved (subcontractor_schedules, manpower_subcontractor_plan, sales_amc_contacts), contrary to the requested no-resolution constraint; 49 remain active. No other finding was marked resolved. Full baseline list below:

- `lov_pgscan` / `lov_db_rls_authenticated_only_v1_89d7ce56a8a7bb9b` — Any signed-in user can read every record in feature_flags — public|feature_flags
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_19f4f01cb58f7651` — Any signed-in user can read every record in this table — public|subcontractor_schedules
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_1db85795bf289ab8` — Any signed-in user can read every record in this table — public|manpower_subcontractor_plan
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_1f69e877a16db2fc` — Any signed-in user can read every record in sales_amc_contacts — public|sales_amc_contacts
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_22495beac5c49912` — Any signed-in user can read every record in panels — public|panels
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_23d54d437576c063` — Any signed-in user can read every record in project_scope_items — public|project_scope_items
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_2bbb67cf4e66a9f3` — Any signed-in user can read every record in qc_checklist_items — public|qc_checklist_items
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_33bd666c1b07361e` — Any signed-in user can read every record in manpower_plans — public|manpower_plans
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_3998cd40b9eb273b` — Any signed-in user can read every record in production_stages — public|production_stages
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_3c61b78466ea5a35` — Any signed-in user can read every record in this table — public|production_task_templates
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_3e8bb692540935a6` — Any signed-in user can read every record in this table — public|installation_checklist
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_47631af455990951` — Any signed-in user can read every record in material_alerts — public|material_alerts
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_47d96cea55587908` — Edits to site_schedules are saved without any checks — public|site_schedules
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_5207afbbe0be3c57` — Any signed-in user can read every record in panel_batches — public|panel_batches
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_536c67bbab721e08` — Any signed-in user can read every record in this table — public|project_task_schedule_uploads
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_57ea12bfca84f57b` — Any signed-in user can read every record in stores_inventory — public|stores_inventory
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_5bc6fc536cd1eb99` — Any signed-in user can read every record in this table — public|depreciation_block_reference
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_5c0113d9c4440a72` — Any signed-in user can read every record in this table — public|manpower_plan_entries
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_62d6ea08059f8af5` — Any signed-in user can read every record in this table — public|site_receipt_checklist
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_6a75e6e5ca291099` — Any signed-in user can read every record in task_benchmarks — public|task_benchmarks
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_6ebc412cf230d613` — Any signed-in user can read every record in sales_stage_history — public|sales_stage_history
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_70c7defb1663a14f` — Any signed-in user can read every record in dispatch_log — public|dispatch_log
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_73dcdffb7e5d900e` — Any signed-in user can read every record in this table — public|design_stage_definitions
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_789488f971f9f369` — Any signed-in user can read every record in role_feature_access — public|role_feature_access
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_80862637f865850e` — Any signed-in user can read every record in module_schedule — public|module_schedule
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_8cd5be19607b44eb` — Any signed-in user can read every record in project_backfills — public|project_backfills
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_8f5b1ff9fcddd553` — Any signed-in user can read every record in announcements — public|announcements
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_95f7378dc0f68bde` — Any signed-in user can read every record in this table — public|project_material_plans
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_a5adf1668cfdb739` — Any signed-in user can read every record in panel_handovers — public|panel_handovers
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_aca8dbaaace2c91d` — Any signed-in user can read every record in dispatch_signoffs — public|dispatch_signoffs
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_ae83a7bde8cd39cd` — Any signed-in user can read every record in kickoff_meetings — public|kickoff_meetings
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_b3da477b6464a4cc` — Any signed-in user can read every record in approval_thresholds — public|approval_thresholds
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_b59c404eac89541d` — Any signed-in user can read every record in stage_wastage — public|stage_wastage
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_b5f5eb15dcf196d9` — Any signed-in user can read every record in red_flag_alerts — public|red_flag_alerts
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_b670b9c3d18b10d0` — Any signed-in user can read every record in this table — public|dispatch_material_log
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_b928042f92bbbfb7` — Any signed-in user can read every record in construction_journal — public|construction_journal
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_bb3fb79507779b52` — Any signed-in user can read every record in payment_approvals — public|payment_approvals
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_bb8865a2eba7794a` — Edits to project_archives are saved without any checks — public|project_archives
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_bc45944cc18c8141` — Any signed-in user can read every record in kpi_definitions — public|kpi_definitions
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_c33d59088ce82cef` — Any signed-in user can read every record in project_subtasks — public|project_subtasks
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_cfdab702ee2b72a1` — Any signed-in user can read every record in design_stage_history — public|design_stage_history
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_e0bed52c12847a24` — Any signed-in user can read every record in this table — public|qc_checklist_definitions
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_e75dc0d971f792d4` — Any signed-in user can read every record in this table — public|project_progress_matrix
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_e7a81f86fd28c0c0` — Any signed-in user can read every record in this table — public|client_milestone_photos
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_f3fdaaa40f70d1fe` — Any signed-in user can read every record in inventory_items — public|inventory_items
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_f419da37ddae4be7` — Any signed-in user can see the phone numbers in site_readiness — public|site_readiness
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_f5721f77761f4a35` — Any signed-in user can read every record in this table — public|project_material_plan_items
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_f897a1226ff65f25` — Any signed-in user can read every record in this table — public|project_scope_exclusions
- `lov_pgscan` / `lov_db_rls_tautology_permissive_v1_f9fa42aa26981ac4` — Any signed-in user can read every record in this table — public|weekly_report_configs
- `lov_pgscan` / `lov_db_storage_objects_owner_unbound_v1_468a2c75b5ab2735` — A rule lets any signed-in user download files in drawings — storage|objects|Authenticated can view drawings
- `lov_pgscan` / `lov_db_storage_objects_owner_unbound_v1_b625fe1ddf634b19` — A rule lets any signed-in user download files in design-files — storage|objects|Authenticated read design stage files
- `lov_pgscan` / `lov_db_storage_objects_owner_unbound_v1_bb23ff90a5e6dfb0` — A rule lets any signed-in user download files in design-files — storage|objects|Authenticated read sale agreements

## Baseline invariants

- reminder_events: 0.
- Eight scheduled jobs: auto-submit-draft-expenses-5-20 (5 0 5,20 * *); daily-checkin-nudge-1300-ist (30 7 * * *); daily-checkin-nudge-1700-ist (30 11 * * *); approval-rejection-dm-5min (*/5 * * * *); error-attribution-dm-5min (*/5 * * * *); uptime-health-check (*/10 * * * *); reminders-hourly (5 * * * *); export-nightly-0130-ist (0 20 * * *). All active. Safe scheduler metadata used; command/credential internals are not exposed by current tools.
- Applied migration: 0033_security1_scoped_reads_private_wip.sql. 13 new backups: 11 policies + 2 WIP writers; total parity2_backup rows 335.
- Five credential-dependent skips replaced with credential-free SQL checks and recorded evidence assertions; 54 live INSERT/UPDATE gate checks passed in rollback. Vitest: 210 passed, zero skipped. Automatic build OK. The checked-in evidence assertions do not rerun live SQL during Vitest; live SQL is provided separately in src/test/security1-access.sql.

## Before → after counts per role and table

Before is the exact total visible through the previous unconditional SELECT policy; after is the authenticated rolled-back live read. All values below are actual read counts. Synthetic missing-role after counts were independently exercised in rollback. Empty tables prove equal empty visibility, not populated-row isolation.

| Role | approval_thresholds | production_stages | project_scope_items | Other 8 changed tables |
|---|---|---|---|---|
| architecture_director | 9 → 9 | 55 → 55 | 82 → 82 | 0 → 0 each |
| costing_engineer | 9 → 9 | 55 → 0 | 82 → 0 | 0 → 0 each |
| delivery_rm_lead | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |
| finance_director | 9 → 9 | 55 → 55 | 82 → 82 | 0 → 0 each |
| finance_manager | 9 → 9 | 55 → 0 | 82 → 0 | 0 → 0 each |
| head_of_projects | 9 → 0 | 55 → 55 | 82 → 82 | 0 → 0 each |
| head_operations | 9 → 0 | 55 → 55 | 82 → 82 | 0 → 0 each |
| hr_executive | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |
| managing_director | 9 → 9 | 55 → 55 | 82 → 82 | 0 → 0 each |
| marketing | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |
| planning_engineer | 9 → 0 | 55 → 55 | 82 → 82 | 0 → 0 each |
| planning_head | 9 → 9 | 55 → 55 | 82 → 82 | 0 → 0 each |
| production_head | 9 → 0 | 55 → 55 | 82 → 82 | 0 → 0 each |
| purchase_assistant | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |
| qc_inspector | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |
| sales_director | 9 → 9 | 55 → 55 | 82 → 82 | 0 → 0 each |
| sales_executive | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |
| stores_executive | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |
| super_admin | 9 → 9 | 55 → 55 | 82 → 82 | 0 → 0 each |
| procurement_assistant (synthetic) | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |
| quantity_surveyor (synthetic) | 9 → 9 | 55 → 0 | 82 → 0 | 0 → 0 each |
| sales_associate (synthetic) | 9 → 0 | 55 → 0 | 82 → 0 | 0 → 0 each |

Other eight changed tables: subcontractor_schedules, manpower_subcontractor_plan, manpower_plans, manpower_plan_entries, panels, project_progress_matrix, qc_checklist_items, sales_amc_contacts.

## Expected finding clearance

The eleven scoped policy findings correspond to subcontractor_schedules, manpower_subcontractor_plan, manpower_plans, manpower_plan_entries, project_scope_items, panels, production_stages, project_progress_matrix, qc_checklist_items, sales_amc_contacts, approval_thresholds. Three were automatically marked fixed; the remaining eight await the user's rescan. UNMAPPED findings remain unchanged.

## Verification and deviations

- site-photos remained private; no bucket transition or legacy getPublicUrl conversion. Existing signed previews render.
- Private WIP: MD, finance_director, sales_director, architecture_director, super_admin and finance_manager each read 3 rows; site_engineer, head_of_projects, stores_executive read 0.
- Old WIP columns remain but are neutralized; preserving old financial values there would defeat privacy.
- Export-nightly deployed and real MD Export Now succeeded; this verification added one audited manual export run and updated only export CSV files.
- INSERT/UPDATE readiness checks evaluate actual policy predicates under authenticated claims without inserting/updating business records.
- Project membership included only where a changed table directly has project_id, as requested; child-table indirect project membership was not invented.
- Existing narrower mapped read/write policies and all UNMAPPED tables remain untouched; this does not guarantee every desired group has access to already-narrow tables.
- Full cron command internals cannot be inspected through current tools; eight safe schedule IDs/names/timings/active states are identical before/after.
- Automatic builds OK; no manual build/typecheck run. Full suite 210 passed/0 skipped.


# SECURITY-2 — live re-audit and verification

Migration 0034_security2_remaining_scoped_reads.sql applied atomically. Live re-audit found 36 open SELECT policies, not 36 change candidates: 30 scoped and 6 left open by design. Two additional UPDATE WITH CHECK=true policies now use an identical copy of their existing USING. All 32 changes have versioned kind=policy backups under security2:public.*; this preserves earlier backups for the same object.

## Counts per group

| Group | SELECT policies scoped |
|---|---:|
| Production and site execution | 14 |
| Site readiness | 1 |
| Dispatch | 3 |
| Material plans | 2 |
| Stores | 2 |
| Finance | 2 |
| Sales | 1 |
| Design | 1 |
| Escalations | 2 |
| Project journal and client photos | 2 |

Total: 30 SELECT policies + 2 UPDATE checks; 32 backups. Existing narrower INSERT/UPDATE/DELETE rules unchanged. No Wave 1 policy changes.

## Synthetic coverage

- fabrication_foreman — **synthetic, not a real-user test**.
- factory_floor_supervisor — **synthetic, not a real-user test**.
- logistics_manager — **synthetic, not a real-user test**.
- principal_architect — **synthetic, not a real-user test**.
- procurement_assistant — **synthetic, not a real-user test**.
- quantity_surveyor — **synthetic, not a real-user test**.
- sales_associate — **synthetic, not a real-user test**.
- senior_factory_supervisor — **synthetic, not a real-user test**.
- structural_architect — **synthetic, not a real-user test**.

31 role subjects × 30 tables = 930 before/after comparisons inside the migration. Group-reader loss or control gain aborted the entire transaction. hr_executive was the control because stores_executive is now a legitimate reader in several groups. Temporary role helpers were restored byte-exact before commit; no accounts, profiles or user_roles rows were written. Independent rollback checks returned all 930 actual after counts. Before counts equal the rows visible under the original unconditional SELECT rules.

## Full before and after counts per role/table

| Table | Role | Test | Before | After |
|---|---|---|---:|---:|
| client_milestone_photos | accounts_executive | active real user | 0 | 0 |
| client_milestone_photos | architecture_director | active real user | 0 | 0 |
| client_milestone_photos | costing_engineer | active real user | 0 | 0 |
| client_milestone_photos | delivery_rm_lead | active real user | 0 | 0 |
| client_milestone_photos | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | finance_director | active real user | 0 | 0 |
| client_milestone_photos | finance_manager | active real user | 0 | 0 |
| client_milestone_photos | head_of_projects | active real user | 0 | 0 |
| client_milestone_photos | head_operations | active real user | 0 | 0 |
| client_milestone_photos | hr_executive | active real user | 0 | 0 |
| client_milestone_photos | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | managing_director | active real user | 0 | 0 |
| client_milestone_photos | planning_engineer | active real user | 0 | 0 |
| client_milestone_photos | planning_head | active real user | 0 | 0 |
| client_milestone_photos | principal_architect | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | production_head | active real user | 0 | 0 |
| client_milestone_photos | project_architect | active real user | 0 | 0 |
| client_milestone_photos | purchase_assistant | active real user | 0 | 0 |
| client_milestone_photos | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | sales_associate | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | sales_director | active real user | 0 | 0 |
| client_milestone_photos | sales_executive | active real user | 0 | 0 |
| client_milestone_photos | senior_architect | active real user | 0 | 0 |
| client_milestone_photos | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | site_engineer | active real user | 0 | 0 |
| client_milestone_photos | site_installation_mgr | active real user | 0 | 0 |
| client_milestone_photos | stores_executive | active real user | 0 | 0 |
| client_milestone_photos | structural_architect | synthetic, not a real-user test | 0 | 0 |
| client_milestone_photos | super_admin | active real user | 0 | 0 |
| construction_journal | accounts_executive | active real user | 0 | 0 |
| construction_journal | architecture_director | active real user | 0 | 0 |
| construction_journal | costing_engineer | active real user | 0 | 0 |
| construction_journal | delivery_rm_lead | active real user | 0 | 0 |
| construction_journal | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| construction_journal | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| construction_journal | finance_director | active real user | 0 | 0 |
| construction_journal | finance_manager | active real user | 0 | 0 |
| construction_journal | head_of_projects | active real user | 0 | 0 |
| construction_journal | head_operations | active real user | 0 | 0 |
| construction_journal | hr_executive | active real user | 0 | 0 |
| construction_journal | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| construction_journal | managing_director | active real user | 0 | 0 |
| construction_journal | planning_engineer | active real user | 0 | 0 |
| construction_journal | planning_head | active real user | 0 | 0 |
| construction_journal | principal_architect | synthetic, not a real-user test | 0 | 0 |
| construction_journal | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| construction_journal | production_head | active real user | 0 | 0 |
| construction_journal | project_architect | active real user | 0 | 0 |
| construction_journal | purchase_assistant | active real user | 0 | 0 |
| construction_journal | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| construction_journal | sales_associate | synthetic, not a real-user test | 0 | 0 |
| construction_journal | sales_director | active real user | 0 | 0 |
| construction_journal | sales_executive | active real user | 0 | 0 |
| construction_journal | senior_architect | active real user | 0 | 0 |
| construction_journal | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| construction_journal | site_engineer | active real user | 0 | 0 |
| construction_journal | site_installation_mgr | active real user | 0 | 0 |
| construction_journal | stores_executive | active real user | 0 | 0 |
| construction_journal | structural_architect | synthetic, not a real-user test | 0 | 0 |
| construction_journal | super_admin | active real user | 0 | 0 |
| depreciation_block_reference | accounts_executive | active real user | 9 | 9 |
| depreciation_block_reference | architecture_director | active real user | 9 | 9 |
| depreciation_block_reference | costing_engineer | active real user | 9 | 0 |
| depreciation_block_reference | delivery_rm_lead | active real user | 9 | 0 |
| depreciation_block_reference | fabrication_foreman | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | factory_floor_supervisor | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | finance_director | active real user | 9 | 9 |
| depreciation_block_reference | finance_manager | active real user | 9 | 9 |
| depreciation_block_reference | head_of_projects | active real user | 9 | 0 |
| depreciation_block_reference | head_operations | active real user | 9 | 0 |
| depreciation_block_reference | hr_executive | active real user | 9 | 0 |
| depreciation_block_reference | logistics_manager | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | managing_director | active real user | 9 | 9 |
| depreciation_block_reference | planning_engineer | active real user | 9 | 0 |
| depreciation_block_reference | planning_head | active real user | 9 | 0 |
| depreciation_block_reference | principal_architect | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | procurement_assistant | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | production_head | active real user | 9 | 0 |
| depreciation_block_reference | project_architect | active real user | 9 | 0 |
| depreciation_block_reference | purchase_assistant | active real user | 9 | 0 |
| depreciation_block_reference | quantity_surveyor | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | sales_associate | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | sales_director | active real user | 9 | 9 |
| depreciation_block_reference | sales_executive | active real user | 9 | 0 |
| depreciation_block_reference | senior_architect | active real user | 9 | 0 |
| depreciation_block_reference | senior_factory_supervisor | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | site_engineer | active real user | 9 | 0 |
| depreciation_block_reference | site_installation_mgr | active real user | 9 | 0 |
| depreciation_block_reference | stores_executive | active real user | 9 | 0 |
| depreciation_block_reference | structural_architect | synthetic, not a real-user test | 9 | 0 |
| depreciation_block_reference | super_admin | active real user | 9 | 9 |
| design_stage_history | accounts_executive | active real user | 0 | 0 |
| design_stage_history | architecture_director | active real user | 0 | 0 |
| design_stage_history | costing_engineer | active real user | 0 | 0 |
| design_stage_history | delivery_rm_lead | active real user | 0 | 0 |
| design_stage_history | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | finance_director | active real user | 0 | 0 |
| design_stage_history | finance_manager | active real user | 0 | 0 |
| design_stage_history | head_of_projects | active real user | 0 | 0 |
| design_stage_history | head_operations | active real user | 0 | 0 |
| design_stage_history | hr_executive | active real user | 0 | 0 |
| design_stage_history | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | managing_director | active real user | 0 | 0 |
| design_stage_history | planning_engineer | active real user | 0 | 0 |
| design_stage_history | planning_head | active real user | 0 | 0 |
| design_stage_history | principal_architect | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | production_head | active real user | 0 | 0 |
| design_stage_history | project_architect | active real user | 0 | 0 |
| design_stage_history | purchase_assistant | active real user | 0 | 0 |
| design_stage_history | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | sales_associate | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | sales_director | active real user | 0 | 0 |
| design_stage_history | sales_executive | active real user | 0 | 0 |
| design_stage_history | senior_architect | active real user | 0 | 0 |
| design_stage_history | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | site_engineer | active real user | 0 | 0 |
| design_stage_history | site_installation_mgr | active real user | 0 | 0 |
| design_stage_history | stores_executive | active real user | 0 | 0 |
| design_stage_history | structural_architect | synthetic, not a real-user test | 0 | 0 |
| design_stage_history | super_admin | active real user | 0 | 0 |
| dispatch_log | accounts_executive | active real user | 0 | 0 |
| dispatch_log | architecture_director | active real user | 0 | 0 |
| dispatch_log | costing_engineer | active real user | 0 | 0 |
| dispatch_log | delivery_rm_lead | active real user | 0 | 0 |
| dispatch_log | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | finance_director | active real user | 0 | 0 |
| dispatch_log | finance_manager | active real user | 0 | 0 |
| dispatch_log | head_of_projects | active real user | 0 | 0 |
| dispatch_log | head_operations | active real user | 0 | 0 |
| dispatch_log | hr_executive | active real user | 0 | 0 |
| dispatch_log | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | managing_director | active real user | 0 | 0 |
| dispatch_log | planning_engineer | active real user | 0 | 0 |
| dispatch_log | planning_head | active real user | 0 | 0 |
| dispatch_log | principal_architect | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | production_head | active real user | 0 | 0 |
| dispatch_log | project_architect | active real user | 0 | 0 |
| dispatch_log | purchase_assistant | active real user | 0 | 0 |
| dispatch_log | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | sales_associate | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | sales_director | active real user | 0 | 0 |
| dispatch_log | sales_executive | active real user | 0 | 0 |
| dispatch_log | senior_architect | active real user | 0 | 0 |
| dispatch_log | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | site_engineer | active real user | 0 | 0 |
| dispatch_log | site_installation_mgr | active real user | 0 | 0 |
| dispatch_log | stores_executive | active real user | 0 | 0 |
| dispatch_log | structural_architect | synthetic, not a real-user test | 0 | 0 |
| dispatch_log | super_admin | active real user | 0 | 0 |
| dispatch_material_log | accounts_executive | active real user | 0 | 0 |
| dispatch_material_log | architecture_director | active real user | 0 | 0 |
| dispatch_material_log | costing_engineer | active real user | 0 | 0 |
| dispatch_material_log | delivery_rm_lead | active real user | 0 | 0 |
| dispatch_material_log | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | finance_director | active real user | 0 | 0 |
| dispatch_material_log | finance_manager | active real user | 0 | 0 |
| dispatch_material_log | head_of_projects | active real user | 0 | 0 |
| dispatch_material_log | head_operations | active real user | 0 | 0 |
| dispatch_material_log | hr_executive | active real user | 0 | 0 |
| dispatch_material_log | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | managing_director | active real user | 0 | 0 |
| dispatch_material_log | planning_engineer | active real user | 0 | 0 |
| dispatch_material_log | planning_head | active real user | 0 | 0 |
| dispatch_material_log | principal_architect | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | production_head | active real user | 0 | 0 |
| dispatch_material_log | project_architect | active real user | 0 | 0 |
| dispatch_material_log | purchase_assistant | active real user | 0 | 0 |
| dispatch_material_log | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | sales_associate | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | sales_director | active real user | 0 | 0 |
| dispatch_material_log | sales_executive | active real user | 0 | 0 |
| dispatch_material_log | senior_architect | active real user | 0 | 0 |
| dispatch_material_log | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | site_engineer | active real user | 0 | 0 |
| dispatch_material_log | site_installation_mgr | active real user | 0 | 0 |
| dispatch_material_log | stores_executive | active real user | 0 | 0 |
| dispatch_material_log | structural_architect | synthetic, not a real-user test | 0 | 0 |
| dispatch_material_log | super_admin | active real user | 0 | 0 |
| dispatch_signoffs | accounts_executive | active real user | 0 | 0 |
| dispatch_signoffs | architecture_director | active real user | 0 | 0 |
| dispatch_signoffs | costing_engineer | active real user | 0 | 0 |
| dispatch_signoffs | delivery_rm_lead | active real user | 0 | 0 |
| dispatch_signoffs | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | finance_director | active real user | 0 | 0 |
| dispatch_signoffs | finance_manager | active real user | 0 | 0 |
| dispatch_signoffs | head_of_projects | active real user | 0 | 0 |
| dispatch_signoffs | head_operations | active real user | 0 | 0 |
| dispatch_signoffs | hr_executive | active real user | 0 | 0 |
| dispatch_signoffs | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | managing_director | active real user | 0 | 0 |
| dispatch_signoffs | planning_engineer | active real user | 0 | 0 |
| dispatch_signoffs | planning_head | active real user | 0 | 0 |
| dispatch_signoffs | principal_architect | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | production_head | active real user | 0 | 0 |
| dispatch_signoffs | project_architect | active real user | 0 | 0 |
| dispatch_signoffs | purchase_assistant | active real user | 0 | 0 |
| dispatch_signoffs | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | sales_associate | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | sales_director | active real user | 0 | 0 |
| dispatch_signoffs | sales_executive | active real user | 0 | 0 |
| dispatch_signoffs | senior_architect | active real user | 0 | 0 |
| dispatch_signoffs | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | site_engineer | active real user | 0 | 0 |
| dispatch_signoffs | site_installation_mgr | active real user | 0 | 0 |
| dispatch_signoffs | stores_executive | active real user | 0 | 0 |
| dispatch_signoffs | structural_architect | synthetic, not a real-user test | 0 | 0 |
| dispatch_signoffs | super_admin | active real user | 0 | 0 |
| installation_checklist | accounts_executive | active real user | 0 | 0 |
| installation_checklist | architecture_director | active real user | 0 | 0 |
| installation_checklist | costing_engineer | active real user | 0 | 0 |
| installation_checklist | delivery_rm_lead | active real user | 0 | 0 |
| installation_checklist | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | finance_director | active real user | 0 | 0 |
| installation_checklist | finance_manager | active real user | 0 | 0 |
| installation_checklist | head_of_projects | active real user | 0 | 0 |
| installation_checklist | head_operations | active real user | 0 | 0 |
| installation_checklist | hr_executive | active real user | 0 | 0 |
| installation_checklist | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | managing_director | active real user | 0 | 0 |
| installation_checklist | planning_engineer | active real user | 0 | 0 |
| installation_checklist | planning_head | active real user | 0 | 0 |
| installation_checklist | principal_architect | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | production_head | active real user | 0 | 0 |
| installation_checklist | project_architect | active real user | 0 | 0 |
| installation_checklist | purchase_assistant | active real user | 0 | 0 |
| installation_checklist | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | sales_associate | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | sales_director | active real user | 0 | 0 |
| installation_checklist | sales_executive | active real user | 0 | 0 |
| installation_checklist | senior_architect | active real user | 0 | 0 |
| installation_checklist | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | site_engineer | active real user | 0 | 0 |
| installation_checklist | site_installation_mgr | active real user | 0 | 0 |
| installation_checklist | stores_executive | active real user | 0 | 0 |
| installation_checklist | structural_architect | synthetic, not a real-user test | 0 | 0 |
| installation_checklist | super_admin | active real user | 0 | 0 |
| inventory_items | accounts_executive | active real user | 0 | 0 |
| inventory_items | architecture_director | active real user | 0 | 0 |
| inventory_items | costing_engineer | active real user | 0 | 0 |
| inventory_items | delivery_rm_lead | active real user | 0 | 0 |
| inventory_items | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| inventory_items | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| inventory_items | finance_director | active real user | 0 | 0 |
| inventory_items | finance_manager | active real user | 0 | 0 |
| inventory_items | head_of_projects | active real user | 0 | 0 |
| inventory_items | head_operations | active real user | 0 | 0 |
| inventory_items | hr_executive | active real user | 0 | 0 |
| inventory_items | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| inventory_items | managing_director | active real user | 0 | 0 |
| inventory_items | planning_engineer | active real user | 0 | 0 |
| inventory_items | planning_head | active real user | 0 | 0 |
| inventory_items | principal_architect | synthetic, not a real-user test | 0 | 0 |
| inventory_items | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| inventory_items | production_head | active real user | 0 | 0 |
| inventory_items | project_architect | active real user | 0 | 0 |
| inventory_items | purchase_assistant | active real user | 0 | 0 |
| inventory_items | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| inventory_items | sales_associate | synthetic, not a real-user test | 0 | 0 |
| inventory_items | sales_director | active real user | 0 | 0 |
| inventory_items | sales_executive | active real user | 0 | 0 |
| inventory_items | senior_architect | active real user | 0 | 0 |
| inventory_items | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| inventory_items | site_engineer | active real user | 0 | 0 |
| inventory_items | site_installation_mgr | active real user | 0 | 0 |
| inventory_items | stores_executive | active real user | 0 | 0 |
| inventory_items | structural_architect | synthetic, not a real-user test | 0 | 0 |
| inventory_items | super_admin | active real user | 0 | 0 |
| kickoff_meetings | accounts_executive | active real user | 1 | 0 |
| kickoff_meetings | architecture_director | active real user | 1 | 1 |
| kickoff_meetings | costing_engineer | active real user | 1 | 0 |
| kickoff_meetings | delivery_rm_lead | active real user | 1 | 0 |
| kickoff_meetings | fabrication_foreman | synthetic, not a real-user test | 1 | 1 |
| kickoff_meetings | factory_floor_supervisor | synthetic, not a real-user test | 1 | 1 |
| kickoff_meetings | finance_director | active real user | 1 | 1 |
| kickoff_meetings | finance_manager | active real user | 1 | 0 |
| kickoff_meetings | head_of_projects | active real user | 1 | 1 |
| kickoff_meetings | head_operations | active real user | 1 | 1 |
| kickoff_meetings | hr_executive | active real user | 1 | 0 |
| kickoff_meetings | logistics_manager | synthetic, not a real-user test | 1 | 0 |
| kickoff_meetings | managing_director | active real user | 1 | 1 |
| kickoff_meetings | planning_engineer | active real user | 1 | 1 |
| kickoff_meetings | planning_head | active real user | 1 | 1 |
| kickoff_meetings | principal_architect | synthetic, not a real-user test | 1 | 0 |
| kickoff_meetings | procurement_assistant | synthetic, not a real-user test | 1 | 0 |
| kickoff_meetings | production_head | active real user | 1 | 1 |
| kickoff_meetings | project_architect | active real user | 1 | 0 |
| kickoff_meetings | purchase_assistant | active real user | 1 | 0 |
| kickoff_meetings | quantity_surveyor | synthetic, not a real-user test | 1 | 0 |
| kickoff_meetings | sales_associate | synthetic, not a real-user test | 1 | 0 |
| kickoff_meetings | sales_director | active real user | 1 | 1 |
| kickoff_meetings | sales_executive | active real user | 1 | 0 |
| kickoff_meetings | senior_architect | active real user | 1 | 0 |
| kickoff_meetings | senior_factory_supervisor | synthetic, not a real-user test | 1 | 1 |
| kickoff_meetings | site_engineer | active real user | 1 | 1 |
| kickoff_meetings | site_installation_mgr | active real user | 1 | 1 |
| kickoff_meetings | stores_executive | active real user | 1 | 0 |
| kickoff_meetings | structural_architect | synthetic, not a real-user test | 1 | 0 |
| kickoff_meetings | super_admin | active real user | 1 | 1 |
| material_alerts | accounts_executive | active real user | 0 | 0 |
| material_alerts | architecture_director | active real user | 0 | 0 |
| material_alerts | costing_engineer | active real user | 0 | 0 |
| material_alerts | delivery_rm_lead | active real user | 0 | 0 |
| material_alerts | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| material_alerts | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| material_alerts | finance_director | active real user | 0 | 0 |
| material_alerts | finance_manager | active real user | 0 | 0 |
| material_alerts | head_of_projects | active real user | 0 | 0 |
| material_alerts | head_operations | active real user | 0 | 0 |
| material_alerts | hr_executive | active real user | 0 | 0 |
| material_alerts | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| material_alerts | managing_director | active real user | 0 | 0 |
| material_alerts | planning_engineer | active real user | 0 | 0 |
| material_alerts | planning_head | active real user | 0 | 0 |
| material_alerts | principal_architect | synthetic, not a real-user test | 0 | 0 |
| material_alerts | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| material_alerts | production_head | active real user | 0 | 0 |
| material_alerts | project_architect | active real user | 0 | 0 |
| material_alerts | purchase_assistant | active real user | 0 | 0 |
| material_alerts | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| material_alerts | sales_associate | synthetic, not a real-user test | 0 | 0 |
| material_alerts | sales_director | active real user | 0 | 0 |
| material_alerts | sales_executive | active real user | 0 | 0 |
| material_alerts | senior_architect | active real user | 0 | 0 |
| material_alerts | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| material_alerts | site_engineer | active real user | 0 | 0 |
| material_alerts | site_installation_mgr | active real user | 0 | 0 |
| material_alerts | stores_executive | active real user | 0 | 0 |
| material_alerts | structural_architect | synthetic, not a real-user test | 0 | 0 |
| material_alerts | super_admin | active real user | 0 | 0 |
| module_schedule | accounts_executive | active real user | 0 | 0 |
| module_schedule | architecture_director | active real user | 0 | 0 |
| module_schedule | costing_engineer | active real user | 0 | 0 |
| module_schedule | delivery_rm_lead | active real user | 0 | 0 |
| module_schedule | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| module_schedule | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| module_schedule | finance_director | active real user | 0 | 0 |
| module_schedule | finance_manager | active real user | 0 | 0 |
| module_schedule | head_of_projects | active real user | 0 | 0 |
| module_schedule | head_operations | active real user | 0 | 0 |
| module_schedule | hr_executive | active real user | 0 | 0 |
| module_schedule | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| module_schedule | managing_director | active real user | 0 | 0 |
| module_schedule | planning_engineer | active real user | 0 | 0 |
| module_schedule | planning_head | active real user | 0 | 0 |
| module_schedule | principal_architect | synthetic, not a real-user test | 0 | 0 |
| module_schedule | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| module_schedule | production_head | active real user | 0 | 0 |
| module_schedule | project_architect | active real user | 0 | 0 |
| module_schedule | purchase_assistant | active real user | 0 | 0 |
| module_schedule | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| module_schedule | sales_associate | synthetic, not a real-user test | 0 | 0 |
| module_schedule | sales_director | active real user | 0 | 0 |
| module_schedule | sales_executive | active real user | 0 | 0 |
| module_schedule | senior_architect | active real user | 0 | 0 |
| module_schedule | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| module_schedule | site_engineer | active real user | 0 | 0 |
| module_schedule | site_installation_mgr | active real user | 0 | 0 |
| module_schedule | stores_executive | active real user | 0 | 0 |
| module_schedule | structural_architect | synthetic, not a real-user test | 0 | 0 |
| module_schedule | super_admin | active real user | 0 | 0 |
| panel_batches | accounts_executive | active real user | 0 | 0 |
| panel_batches | architecture_director | active real user | 0 | 0 |
| panel_batches | costing_engineer | active real user | 0 | 0 |
| panel_batches | delivery_rm_lead | active real user | 0 | 0 |
| panel_batches | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| panel_batches | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| panel_batches | finance_director | active real user | 0 | 0 |
| panel_batches | finance_manager | active real user | 0 | 0 |
| panel_batches | head_of_projects | active real user | 0 | 0 |
| panel_batches | head_operations | active real user | 0 | 0 |
| panel_batches | hr_executive | active real user | 0 | 0 |
| panel_batches | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| panel_batches | managing_director | active real user | 0 | 0 |
| panel_batches | planning_engineer | active real user | 0 | 0 |
| panel_batches | planning_head | active real user | 0 | 0 |
| panel_batches | principal_architect | synthetic, not a real-user test | 0 | 0 |
| panel_batches | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| panel_batches | production_head | active real user | 0 | 0 |
| panel_batches | project_architect | active real user | 0 | 0 |
| panel_batches | purchase_assistant | active real user | 0 | 0 |
| panel_batches | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| panel_batches | sales_associate | synthetic, not a real-user test | 0 | 0 |
| panel_batches | sales_director | active real user | 0 | 0 |
| panel_batches | sales_executive | active real user | 0 | 0 |
| panel_batches | senior_architect | active real user | 0 | 0 |
| panel_batches | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| panel_batches | site_engineer | active real user | 0 | 0 |
| panel_batches | site_installation_mgr | active real user | 0 | 0 |
| panel_batches | stores_executive | active real user | 0 | 0 |
| panel_batches | structural_architect | synthetic, not a real-user test | 0 | 0 |
| panel_batches | super_admin | active real user | 0 | 0 |
| panel_handovers | accounts_executive | active real user | 0 | 0 |
| panel_handovers | architecture_director | active real user | 0 | 0 |
| panel_handovers | costing_engineer | active real user | 0 | 0 |
| panel_handovers | delivery_rm_lead | active real user | 0 | 0 |
| panel_handovers | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | finance_director | active real user | 0 | 0 |
| panel_handovers | finance_manager | active real user | 0 | 0 |
| panel_handovers | head_of_projects | active real user | 0 | 0 |
| panel_handovers | head_operations | active real user | 0 | 0 |
| panel_handovers | hr_executive | active real user | 0 | 0 |
| panel_handovers | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | managing_director | active real user | 0 | 0 |
| panel_handovers | planning_engineer | active real user | 0 | 0 |
| panel_handovers | planning_head | active real user | 0 | 0 |
| panel_handovers | principal_architect | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | production_head | active real user | 0 | 0 |
| panel_handovers | project_architect | active real user | 0 | 0 |
| panel_handovers | purchase_assistant | active real user | 0 | 0 |
| panel_handovers | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | sales_associate | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | sales_director | active real user | 0 | 0 |
| panel_handovers | sales_executive | active real user | 0 | 0 |
| panel_handovers | senior_architect | active real user | 0 | 0 |
| panel_handovers | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | site_engineer | active real user | 0 | 0 |
| panel_handovers | site_installation_mgr | active real user | 0 | 0 |
| panel_handovers | stores_executive | active real user | 0 | 0 |
| panel_handovers | structural_architect | synthetic, not a real-user test | 0 | 0 |
| panel_handovers | super_admin | active real user | 0 | 0 |
| payment_approvals | accounts_executive | active real user | 0 | 0 |
| payment_approvals | architecture_director | active real user | 0 | 0 |
| payment_approvals | costing_engineer | active real user | 0 | 0 |
| payment_approvals | delivery_rm_lead | active real user | 0 | 0 |
| payment_approvals | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | finance_director | active real user | 0 | 0 |
| payment_approvals | finance_manager | active real user | 0 | 0 |
| payment_approvals | head_of_projects | active real user | 0 | 0 |
| payment_approvals | head_operations | active real user | 0 | 0 |
| payment_approvals | hr_executive | active real user | 0 | 0 |
| payment_approvals | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | managing_director | active real user | 0 | 0 |
| payment_approvals | planning_engineer | active real user | 0 | 0 |
| payment_approvals | planning_head | active real user | 0 | 0 |
| payment_approvals | principal_architect | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | production_head | active real user | 0 | 0 |
| payment_approvals | project_architect | active real user | 0 | 0 |
| payment_approvals | purchase_assistant | active real user | 0 | 0 |
| payment_approvals | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | sales_associate | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | sales_director | active real user | 0 | 0 |
| payment_approvals | sales_executive | active real user | 0 | 0 |
| payment_approvals | senior_architect | active real user | 0 | 0 |
| payment_approvals | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | site_engineer | active real user | 0 | 0 |
| payment_approvals | site_installation_mgr | active real user | 0 | 0 |
| payment_approvals | stores_executive | active real user | 0 | 0 |
| payment_approvals | structural_architect | synthetic, not a real-user test | 0 | 0 |
| payment_approvals | super_admin | active real user | 0 | 0 |
| production_task_templates | accounts_executive | active real user | 475 | 0 |
| production_task_templates | architecture_director | active real user | 475 | 475 |
| production_task_templates | costing_engineer | active real user | 475 | 0 |
| production_task_templates | delivery_rm_lead | active real user | 475 | 0 |
| production_task_templates | fabrication_foreman | synthetic, not a real-user test | 475 | 475 |
| production_task_templates | factory_floor_supervisor | synthetic, not a real-user test | 475 | 475 |
| production_task_templates | finance_director | active real user | 475 | 475 |
| production_task_templates | finance_manager | active real user | 475 | 0 |
| production_task_templates | head_of_projects | active real user | 475 | 475 |
| production_task_templates | head_operations | active real user | 475 | 475 |
| production_task_templates | hr_executive | active real user | 475 | 0 |
| production_task_templates | logistics_manager | synthetic, not a real-user test | 475 | 0 |
| production_task_templates | managing_director | active real user | 475 | 475 |
| production_task_templates | planning_engineer | active real user | 475 | 475 |
| production_task_templates | planning_head | active real user | 475 | 475 |
| production_task_templates | principal_architect | synthetic, not a real-user test | 475 | 0 |
| production_task_templates | procurement_assistant | synthetic, not a real-user test | 475 | 0 |
| production_task_templates | production_head | active real user | 475 | 475 |
| production_task_templates | project_architect | active real user | 475 | 0 |
| production_task_templates | purchase_assistant | active real user | 475 | 0 |
| production_task_templates | quantity_surveyor | synthetic, not a real-user test | 475 | 0 |
| production_task_templates | sales_associate | synthetic, not a real-user test | 475 | 0 |
| production_task_templates | sales_director | active real user | 475 | 475 |
| production_task_templates | sales_executive | active real user | 475 | 0 |
| production_task_templates | senior_architect | active real user | 475 | 0 |
| production_task_templates | senior_factory_supervisor | synthetic, not a real-user test | 475 | 475 |
| production_task_templates | site_engineer | active real user | 475 | 475 |
| production_task_templates | site_installation_mgr | active real user | 475 | 475 |
| production_task_templates | stores_executive | active real user | 475 | 0 |
| production_task_templates | structural_architect | synthetic, not a real-user test | 475 | 0 |
| production_task_templates | super_admin | active real user | 475 | 475 |
| project_backfills | accounts_executive | active real user | 1 | 0 |
| project_backfills | architecture_director | active real user | 1 | 1 |
| project_backfills | costing_engineer | active real user | 1 | 0 |
| project_backfills | delivery_rm_lead | active real user | 1 | 0 |
| project_backfills | fabrication_foreman | synthetic, not a real-user test | 1 | 1 |
| project_backfills | factory_floor_supervisor | synthetic, not a real-user test | 1 | 1 |
| project_backfills | finance_director | active real user | 1 | 1 |
| project_backfills | finance_manager | active real user | 1 | 0 |
| project_backfills | head_of_projects | active real user | 1 | 1 |
| project_backfills | head_operations | active real user | 1 | 1 |
| project_backfills | hr_executive | active real user | 1 | 0 |
| project_backfills | logistics_manager | synthetic, not a real-user test | 1 | 0 |
| project_backfills | managing_director | active real user | 1 | 1 |
| project_backfills | planning_engineer | active real user | 1 | 1 |
| project_backfills | planning_head | active real user | 1 | 1 |
| project_backfills | principal_architect | synthetic, not a real-user test | 1 | 0 |
| project_backfills | procurement_assistant | synthetic, not a real-user test | 1 | 0 |
| project_backfills | production_head | active real user | 1 | 1 |
| project_backfills | project_architect | active real user | 1 | 0 |
| project_backfills | purchase_assistant | active real user | 1 | 0 |
| project_backfills | quantity_surveyor | synthetic, not a real-user test | 1 | 0 |
| project_backfills | sales_associate | synthetic, not a real-user test | 1 | 0 |
| project_backfills | sales_director | active real user | 1 | 1 |
| project_backfills | sales_executive | active real user | 1 | 0 |
| project_backfills | senior_architect | active real user | 1 | 0 |
| project_backfills | senior_factory_supervisor | synthetic, not a real-user test | 1 | 1 |
| project_backfills | site_engineer | active real user | 1 | 1 |
| project_backfills | site_installation_mgr | active real user | 1 | 1 |
| project_backfills | stores_executive | active real user | 1 | 0 |
| project_backfills | structural_architect | synthetic, not a real-user test | 1 | 0 |
| project_backfills | super_admin | active real user | 1 | 1 |
| project_material_plan_items | accounts_executive | active real user | 320 | 0 |
| project_material_plan_items | architecture_director | active real user | 320 | 320 |
| project_material_plan_items | costing_engineer | active real user | 320 | 320 |
| project_material_plan_items | delivery_rm_lead | active real user | 320 | 0 |
| project_material_plan_items | fabrication_foreman | synthetic, not a real-user test | 320 | 0 |
| project_material_plan_items | factory_floor_supervisor | synthetic, not a real-user test | 320 | 0 |
| project_material_plan_items | finance_director | active real user | 320 | 320 |
| project_material_plan_items | finance_manager | active real user | 320 | 320 |
| project_material_plan_items | head_of_projects | active real user | 320 | 320 |
| project_material_plan_items | head_operations | active real user | 320 | 0 |
| project_material_plan_items | hr_executive | active real user | 320 | 0 |
| project_material_plan_items | logistics_manager | synthetic, not a real-user test | 320 | 0 |
| project_material_plan_items | managing_director | active real user | 320 | 320 |
| project_material_plan_items | planning_engineer | active real user | 320 | 320 |
| project_material_plan_items | planning_head | active real user | 320 | 320 |
| project_material_plan_items | principal_architect | synthetic, not a real-user test | 320 | 0 |
| project_material_plan_items | procurement_assistant | synthetic, not a real-user test | 320 | 320 |
| project_material_plan_items | production_head | active real user | 320 | 320 |
| project_material_plan_items | project_architect | active real user | 320 | 0 |
| project_material_plan_items | purchase_assistant | active real user | 320 | 320 |
| project_material_plan_items | quantity_surveyor | synthetic, not a real-user test | 320 | 320 |
| project_material_plan_items | sales_associate | synthetic, not a real-user test | 320 | 0 |
| project_material_plan_items | sales_director | active real user | 320 | 320 |
| project_material_plan_items | sales_executive | active real user | 320 | 0 |
| project_material_plan_items | senior_architect | active real user | 320 | 0 |
| project_material_plan_items | senior_factory_supervisor | synthetic, not a real-user test | 320 | 0 |
| project_material_plan_items | site_engineer | active real user | 320 | 0 |
| project_material_plan_items | site_installation_mgr | active real user | 320 | 0 |
| project_material_plan_items | stores_executive | active real user | 320 | 320 |
| project_material_plan_items | structural_architect | synthetic, not a real-user test | 320 | 0 |
| project_material_plan_items | super_admin | active real user | 320 | 320 |
| project_material_plans | accounts_executive | active real user | 7 | 0 |
| project_material_plans | architecture_director | active real user | 7 | 7 |
| project_material_plans | costing_engineer | active real user | 7 | 7 |
| project_material_plans | delivery_rm_lead | active real user | 7 | 0 |
| project_material_plans | fabrication_foreman | synthetic, not a real-user test | 7 | 0 |
| project_material_plans | factory_floor_supervisor | synthetic, not a real-user test | 7 | 0 |
| project_material_plans | finance_director | active real user | 7 | 7 |
| project_material_plans | finance_manager | active real user | 7 | 7 |
| project_material_plans | head_of_projects | active real user | 7 | 7 |
| project_material_plans | head_operations | active real user | 7 | 0 |
| project_material_plans | hr_executive | active real user | 7 | 0 |
| project_material_plans | logistics_manager | synthetic, not a real-user test | 7 | 0 |
| project_material_plans | managing_director | active real user | 7 | 7 |
| project_material_plans | planning_engineer | active real user | 7 | 7 |
| project_material_plans | planning_head | active real user | 7 | 7 |
| project_material_plans | principal_architect | synthetic, not a real-user test | 7 | 0 |
| project_material_plans | procurement_assistant | synthetic, not a real-user test | 7 | 7 |
| project_material_plans | production_head | active real user | 7 | 7 |
| project_material_plans | project_architect | active real user | 7 | 0 |
| project_material_plans | purchase_assistant | active real user | 7 | 7 |
| project_material_plans | quantity_surveyor | synthetic, not a real-user test | 7 | 7 |
| project_material_plans | sales_associate | synthetic, not a real-user test | 7 | 0 |
| project_material_plans | sales_director | active real user | 7 | 7 |
| project_material_plans | sales_executive | active real user | 7 | 0 |
| project_material_plans | senior_architect | active real user | 7 | 0 |
| project_material_plans | senior_factory_supervisor | synthetic, not a real-user test | 7 | 0 |
| project_material_plans | site_engineer | active real user | 7 | 0 |
| project_material_plans | site_installation_mgr | active real user | 7 | 0 |
| project_material_plans | stores_executive | active real user | 7 | 7 |
| project_material_plans | structural_architect | synthetic, not a real-user test | 7 | 0 |
| project_material_plans | super_admin | active real user | 7 | 7 |
| project_scope_exclusions | accounts_executive | active real user | 14 | 0 |
| project_scope_exclusions | architecture_director | active real user | 14 | 14 |
| project_scope_exclusions | costing_engineer | active real user | 14 | 0 |
| project_scope_exclusions | delivery_rm_lead | active real user | 14 | 0 |
| project_scope_exclusions | fabrication_foreman | synthetic, not a real-user test | 14 | 14 |
| project_scope_exclusions | factory_floor_supervisor | synthetic, not a real-user test | 14 | 14 |
| project_scope_exclusions | finance_director | active real user | 14 | 14 |
| project_scope_exclusions | finance_manager | active real user | 14 | 0 |
| project_scope_exclusions | head_of_projects | active real user | 14 | 14 |
| project_scope_exclusions | head_operations | active real user | 14 | 14 |
| project_scope_exclusions | hr_executive | active real user | 14 | 0 |
| project_scope_exclusions | logistics_manager | synthetic, not a real-user test | 14 | 0 |
| project_scope_exclusions | managing_director | active real user | 14 | 14 |
| project_scope_exclusions | planning_engineer | active real user | 14 | 14 |
| project_scope_exclusions | planning_head | active real user | 14 | 14 |
| project_scope_exclusions | principal_architect | synthetic, not a real-user test | 14 | 0 |
| project_scope_exclusions | procurement_assistant | synthetic, not a real-user test | 14 | 0 |
| project_scope_exclusions | production_head | active real user | 14 | 14 |
| project_scope_exclusions | project_architect | active real user | 14 | 0 |
| project_scope_exclusions | purchase_assistant | active real user | 14 | 0 |
| project_scope_exclusions | quantity_surveyor | synthetic, not a real-user test | 14 | 0 |
| project_scope_exclusions | sales_associate | synthetic, not a real-user test | 14 | 0 |
| project_scope_exclusions | sales_director | active real user | 14 | 14 |
| project_scope_exclusions | sales_executive | active real user | 14 | 0 |
| project_scope_exclusions | senior_architect | active real user | 14 | 0 |
| project_scope_exclusions | senior_factory_supervisor | synthetic, not a real-user test | 14 | 14 |
| project_scope_exclusions | site_engineer | active real user | 14 | 14 |
| project_scope_exclusions | site_installation_mgr | active real user | 14 | 14 |
| project_scope_exclusions | stores_executive | active real user | 14 | 0 |
| project_scope_exclusions | structural_architect | synthetic, not a real-user test | 14 | 0 |
| project_scope_exclusions | super_admin | active real user | 14 | 14 |
| project_subtasks | accounts_executive | active real user | 0 | 0 |
| project_subtasks | architecture_director | active real user | 0 | 0 |
| project_subtasks | costing_engineer | active real user | 0 | 0 |
| project_subtasks | delivery_rm_lead | active real user | 0 | 0 |
| project_subtasks | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | finance_director | active real user | 0 | 0 |
| project_subtasks | finance_manager | active real user | 0 | 0 |
| project_subtasks | head_of_projects | active real user | 0 | 0 |
| project_subtasks | head_operations | active real user | 0 | 0 |
| project_subtasks | hr_executive | active real user | 0 | 0 |
| project_subtasks | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | managing_director | active real user | 0 | 0 |
| project_subtasks | planning_engineer | active real user | 0 | 0 |
| project_subtasks | planning_head | active real user | 0 | 0 |
| project_subtasks | principal_architect | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | production_head | active real user | 0 | 0 |
| project_subtasks | project_architect | active real user | 0 | 0 |
| project_subtasks | purchase_assistant | active real user | 0 | 0 |
| project_subtasks | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | sales_associate | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | sales_director | active real user | 0 | 0 |
| project_subtasks | sales_executive | active real user | 0 | 0 |
| project_subtasks | senior_architect | active real user | 0 | 0 |
| project_subtasks | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | site_engineer | active real user | 0 | 0 |
| project_subtasks | site_installation_mgr | active real user | 0 | 0 |
| project_subtasks | stores_executive | active real user | 0 | 0 |
| project_subtasks | structural_architect | synthetic, not a real-user test | 0 | 0 |
| project_subtasks | super_admin | active real user | 0 | 0 |
| project_task_schedule_uploads | accounts_executive | active real user | 0 | 0 |
| project_task_schedule_uploads | architecture_director | active real user | 0 | 0 |
| project_task_schedule_uploads | costing_engineer | active real user | 0 | 0 |
| project_task_schedule_uploads | delivery_rm_lead | active real user | 0 | 0 |
| project_task_schedule_uploads | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | finance_director | active real user | 0 | 0 |
| project_task_schedule_uploads | finance_manager | active real user | 0 | 0 |
| project_task_schedule_uploads | head_of_projects | active real user | 0 | 0 |
| project_task_schedule_uploads | head_operations | active real user | 0 | 0 |
| project_task_schedule_uploads | hr_executive | active real user | 0 | 0 |
| project_task_schedule_uploads | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | managing_director | active real user | 0 | 0 |
| project_task_schedule_uploads | planning_engineer | active real user | 0 | 0 |
| project_task_schedule_uploads | planning_head | active real user | 0 | 0 |
| project_task_schedule_uploads | principal_architect | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | production_head | active real user | 0 | 0 |
| project_task_schedule_uploads | project_architect | active real user | 0 | 0 |
| project_task_schedule_uploads | purchase_assistant | active real user | 0 | 0 |
| project_task_schedule_uploads | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | sales_associate | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | sales_director | active real user | 0 | 0 |
| project_task_schedule_uploads | sales_executive | active real user | 0 | 0 |
| project_task_schedule_uploads | senior_architect | active real user | 0 | 0 |
| project_task_schedule_uploads | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | site_engineer | active real user | 0 | 0 |
| project_task_schedule_uploads | site_installation_mgr | active real user | 0 | 0 |
| project_task_schedule_uploads | stores_executive | active real user | 0 | 0 |
| project_task_schedule_uploads | structural_architect | synthetic, not a real-user test | 0 | 0 |
| project_task_schedule_uploads | super_admin | active real user | 0 | 0 |
| red_flag_alerts | accounts_executive | active real user | 0 | 0 |
| red_flag_alerts | architecture_director | active real user | 0 | 0 |
| red_flag_alerts | costing_engineer | active real user | 0 | 0 |
| red_flag_alerts | delivery_rm_lead | active real user | 0 | 0 |
| red_flag_alerts | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | finance_director | active real user | 0 | 0 |
| red_flag_alerts | finance_manager | active real user | 0 | 0 |
| red_flag_alerts | head_of_projects | active real user | 0 | 0 |
| red_flag_alerts | head_operations | active real user | 0 | 0 |
| red_flag_alerts | hr_executive | active real user | 0 | 0 |
| red_flag_alerts | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | managing_director | active real user | 0 | 0 |
| red_flag_alerts | planning_engineer | active real user | 0 | 0 |
| red_flag_alerts | planning_head | active real user | 0 | 0 |
| red_flag_alerts | principal_architect | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | production_head | active real user | 0 | 0 |
| red_flag_alerts | project_architect | active real user | 0 | 0 |
| red_flag_alerts | purchase_assistant | active real user | 0 | 0 |
| red_flag_alerts | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | sales_associate | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | sales_director | active real user | 0 | 0 |
| red_flag_alerts | sales_executive | active real user | 0 | 0 |
| red_flag_alerts | senior_architect | active real user | 0 | 0 |
| red_flag_alerts | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | site_engineer | active real user | 0 | 0 |
| red_flag_alerts | site_installation_mgr | active real user | 0 | 0 |
| red_flag_alerts | stores_executive | active real user | 0 | 0 |
| red_flag_alerts | structural_architect | synthetic, not a real-user test | 0 | 0 |
| red_flag_alerts | super_admin | active real user | 0 | 0 |
| sales_stage_history | accounts_executive | active real user | 0 | 0 |
| sales_stage_history | architecture_director | active real user | 0 | 0 |
| sales_stage_history | costing_engineer | active real user | 0 | 0 |
| sales_stage_history | delivery_rm_lead | active real user | 0 | 0 |
| sales_stage_history | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | finance_director | active real user | 0 | 0 |
| sales_stage_history | finance_manager | active real user | 0 | 0 |
| sales_stage_history | head_of_projects | active real user | 0 | 0 |
| sales_stage_history | head_operations | active real user | 0 | 0 |
| sales_stage_history | hr_executive | active real user | 0 | 0 |
| sales_stage_history | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | managing_director | active real user | 0 | 0 |
| sales_stage_history | planning_engineer | active real user | 0 | 0 |
| sales_stage_history | planning_head | active real user | 0 | 0 |
| sales_stage_history | principal_architect | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | production_head | active real user | 0 | 0 |
| sales_stage_history | project_architect | active real user | 0 | 0 |
| sales_stage_history | purchase_assistant | active real user | 0 | 0 |
| sales_stage_history | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | sales_associate | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | sales_director | active real user | 0 | 0 |
| sales_stage_history | sales_executive | active real user | 0 | 0 |
| sales_stage_history | senior_architect | active real user | 0 | 0 |
| sales_stage_history | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | site_engineer | active real user | 0 | 0 |
| sales_stage_history | site_installation_mgr | active real user | 0 | 0 |
| sales_stage_history | stores_executive | active real user | 0 | 0 |
| sales_stage_history | structural_architect | synthetic, not a real-user test | 0 | 0 |
| sales_stage_history | super_admin | active real user | 0 | 0 |
| site_readiness | accounts_executive | active real user | 3 | 0 |
| site_readiness | architecture_director | active real user | 3 | 3 |
| site_readiness | costing_engineer | active real user | 3 | 1 |
| site_readiness | delivery_rm_lead | active real user | 3 | 3 |
| site_readiness | fabrication_foreman | synthetic, not a real-user test | 3 | 3 |
| site_readiness | factory_floor_supervisor | synthetic, not a real-user test | 3 | 3 |
| site_readiness | finance_director | active real user | 3 | 3 |
| site_readiness | finance_manager | active real user | 3 | 0 |
| site_readiness | head_of_projects | active real user | 3 | 3 |
| site_readiness | head_operations | active real user | 3 | 3 |
| site_readiness | hr_executive | active real user | 3 | 0 |
| site_readiness | logistics_manager | synthetic, not a real-user test | 3 | 0 |
| site_readiness | managing_director | active real user | 3 | 3 |
| site_readiness | planning_engineer | active real user | 3 | 3 |
| site_readiness | planning_head | active real user | 3 | 3 |
| site_readiness | principal_architect | synthetic, not a real-user test | 3 | 0 |
| site_readiness | procurement_assistant | synthetic, not a real-user test | 3 | 0 |
| site_readiness | production_head | active real user | 3 | 3 |
| site_readiness | project_architect | active real user | 3 | 2 |
| site_readiness | purchase_assistant | active real user | 3 | 0 |
| site_readiness | quantity_surveyor | synthetic, not a real-user test | 3 | 0 |
| site_readiness | sales_associate | synthetic, not a real-user test | 3 | 0 |
| site_readiness | sales_director | active real user | 3 | 3 |
| site_readiness | sales_executive | active real user | 3 | 0 |
| site_readiness | senior_architect | active real user | 3 | 0 |
| site_readiness | senior_factory_supervisor | synthetic, not a real-user test | 3 | 3 |
| site_readiness | site_engineer | active real user | 3 | 3 |
| site_readiness | site_installation_mgr | active real user | 3 | 3 |
| site_readiness | stores_executive | active real user | 3 | 0 |
| site_readiness | structural_architect | synthetic, not a real-user test | 3 | 0 |
| site_readiness | super_admin | active real user | 3 | 3 |
| site_receipt_checklist | accounts_executive | active real user | 0 | 0 |
| site_receipt_checklist | architecture_director | active real user | 0 | 0 |
| site_receipt_checklist | costing_engineer | active real user | 0 | 0 |
| site_receipt_checklist | delivery_rm_lead | active real user | 0 | 0 |
| site_receipt_checklist | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | finance_director | active real user | 0 | 0 |
| site_receipt_checklist | finance_manager | active real user | 0 | 0 |
| site_receipt_checklist | head_of_projects | active real user | 0 | 0 |
| site_receipt_checklist | head_operations | active real user | 0 | 0 |
| site_receipt_checklist | hr_executive | active real user | 0 | 0 |
| site_receipt_checklist | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | managing_director | active real user | 0 | 0 |
| site_receipt_checklist | planning_engineer | active real user | 0 | 0 |
| site_receipt_checklist | planning_head | active real user | 0 | 0 |
| site_receipt_checklist | principal_architect | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | production_head | active real user | 0 | 0 |
| site_receipt_checklist | project_architect | active real user | 0 | 0 |
| site_receipt_checklist | purchase_assistant | active real user | 0 | 0 |
| site_receipt_checklist | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | sales_associate | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | sales_director | active real user | 0 | 0 |
| site_receipt_checklist | sales_executive | active real user | 0 | 0 |
| site_receipt_checklist | senior_architect | active real user | 0 | 0 |
| site_receipt_checklist | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | site_engineer | active real user | 0 | 0 |
| site_receipt_checklist | site_installation_mgr | active real user | 0 | 0 |
| site_receipt_checklist | stores_executive | active real user | 0 | 0 |
| site_receipt_checklist | structural_architect | synthetic, not a real-user test | 0 | 0 |
| site_receipt_checklist | super_admin | active real user | 0 | 0 |
| stage_wastage | accounts_executive | active real user | 0 | 0 |
| stage_wastage | architecture_director | active real user | 0 | 0 |
| stage_wastage | costing_engineer | active real user | 0 | 0 |
| stage_wastage | delivery_rm_lead | active real user | 0 | 0 |
| stage_wastage | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | finance_director | active real user | 0 | 0 |
| stage_wastage | finance_manager | active real user | 0 | 0 |
| stage_wastage | head_of_projects | active real user | 0 | 0 |
| stage_wastage | head_operations | active real user | 0 | 0 |
| stage_wastage | hr_executive | active real user | 0 | 0 |
| stage_wastage | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | managing_director | active real user | 0 | 0 |
| stage_wastage | planning_engineer | active real user | 0 | 0 |
| stage_wastage | planning_head | active real user | 0 | 0 |
| stage_wastage | principal_architect | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | production_head | active real user | 0 | 0 |
| stage_wastage | project_architect | active real user | 0 | 0 |
| stage_wastage | purchase_assistant | active real user | 0 | 0 |
| stage_wastage | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | sales_associate | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | sales_director | active real user | 0 | 0 |
| stage_wastage | sales_executive | active real user | 0 | 0 |
| stage_wastage | senior_architect | active real user | 0 | 0 |
| stage_wastage | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | site_engineer | active real user | 0 | 0 |
| stage_wastage | site_installation_mgr | active real user | 0 | 0 |
| stage_wastage | stores_executive | active real user | 0 | 0 |
| stage_wastage | structural_architect | synthetic, not a real-user test | 0 | 0 |
| stage_wastage | super_admin | active real user | 0 | 0 |
| stores_inventory | accounts_executive | active real user | 0 | 0 |
| stores_inventory | architecture_director | active real user | 0 | 0 |
| stores_inventory | costing_engineer | active real user | 0 | 0 |
| stores_inventory | delivery_rm_lead | active real user | 0 | 0 |
| stores_inventory | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | finance_director | active real user | 0 | 0 |
| stores_inventory | finance_manager | active real user | 0 | 0 |
| stores_inventory | head_of_projects | active real user | 0 | 0 |
| stores_inventory | head_operations | active real user | 0 | 0 |
| stores_inventory | hr_executive | active real user | 0 | 0 |
| stores_inventory | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | managing_director | active real user | 0 | 0 |
| stores_inventory | planning_engineer | active real user | 0 | 0 |
| stores_inventory | planning_head | active real user | 0 | 0 |
| stores_inventory | principal_architect | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | production_head | active real user | 0 | 0 |
| stores_inventory | project_architect | active real user | 0 | 0 |
| stores_inventory | purchase_assistant | active real user | 0 | 0 |
| stores_inventory | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | sales_associate | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | sales_director | active real user | 0 | 0 |
| stores_inventory | sales_executive | active real user | 0 | 0 |
| stores_inventory | senior_architect | active real user | 0 | 0 |
| stores_inventory | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | site_engineer | active real user | 0 | 0 |
| stores_inventory | site_installation_mgr | active real user | 0 | 0 |
| stores_inventory | stores_executive | active real user | 0 | 0 |
| stores_inventory | structural_architect | synthetic, not a real-user test | 0 | 0 |
| stores_inventory | super_admin | active real user | 0 | 0 |
| task_benchmarks | accounts_executive | active real user | 0 | 0 |
| task_benchmarks | architecture_director | active real user | 0 | 0 |
| task_benchmarks | costing_engineer | active real user | 0 | 0 |
| task_benchmarks | delivery_rm_lead | active real user | 0 | 0 |
| task_benchmarks | fabrication_foreman | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | factory_floor_supervisor | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | finance_director | active real user | 0 | 0 |
| task_benchmarks | finance_manager | active real user | 0 | 0 |
| task_benchmarks | head_of_projects | active real user | 0 | 0 |
| task_benchmarks | head_operations | active real user | 0 | 0 |
| task_benchmarks | hr_executive | active real user | 0 | 0 |
| task_benchmarks | logistics_manager | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | managing_director | active real user | 0 | 0 |
| task_benchmarks | planning_engineer | active real user | 0 | 0 |
| task_benchmarks | planning_head | active real user | 0 | 0 |
| task_benchmarks | principal_architect | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | procurement_assistant | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | production_head | active real user | 0 | 0 |
| task_benchmarks | project_architect | active real user | 0 | 0 |
| task_benchmarks | purchase_assistant | active real user | 0 | 0 |
| task_benchmarks | quantity_surveyor | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | sales_associate | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | sales_director | active real user | 0 | 0 |
| task_benchmarks | sales_executive | active real user | 0 | 0 |
| task_benchmarks | senior_architect | active real user | 0 | 0 |
| task_benchmarks | senior_factory_supervisor | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | site_engineer | active real user | 0 | 0 |
| task_benchmarks | site_installation_mgr | active real user | 0 | 0 |
| task_benchmarks | stores_executive | active real user | 0 | 0 |
| task_benchmarks | structural_architect | synthetic, not a real-user test | 0 | 0 |
| task_benchmarks | super_admin | active real user | 0 | 0 |
| weekly_report_configs | accounts_executive | active real user | 5 | 0 |
| weekly_report_configs | architecture_director | active real user | 5 | 5 |
| weekly_report_configs | costing_engineer | active real user | 5 | 0 |
| weekly_report_configs | delivery_rm_lead | active real user | 5 | 0 |
| weekly_report_configs | fabrication_foreman | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | factory_floor_supervisor | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | finance_director | active real user | 5 | 5 |
| weekly_report_configs | finance_manager | active real user | 5 | 5 |
| weekly_report_configs | head_of_projects | active real user | 5 | 5 |
| weekly_report_configs | head_operations | active real user | 5 | 5 |
| weekly_report_configs | hr_executive | active real user | 5 | 0 |
| weekly_report_configs | logistics_manager | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | managing_director | active real user | 5 | 5 |
| weekly_report_configs | planning_engineer | active real user | 5 | 0 |
| weekly_report_configs | planning_head | active real user | 5 | 5 |
| weekly_report_configs | principal_architect | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | procurement_assistant | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | production_head | active real user | 5 | 5 |
| weekly_report_configs | project_architect | active real user | 5 | 0 |
| weekly_report_configs | purchase_assistant | active real user | 5 | 0 |
| weekly_report_configs | quantity_surveyor | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | sales_associate | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | sales_director | active real user | 5 | 5 |
| weekly_report_configs | sales_executive | active real user | 5 | 0 |
| weekly_report_configs | senior_architect | active real user | 5 | 0 |
| weekly_report_configs | senior_factory_supervisor | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | site_engineer | active real user | 5 | 0 |
| weekly_report_configs | site_installation_mgr | active real user | 5 | 0 |
| weekly_report_configs | stores_executive | active real user | 5 | 0 |
| weekly_report_configs | structural_architect | synthetic, not a real-user test | 5 | 0 |
| weekly_report_configs | super_admin | active real user | 5 | 5 |

## Remaining open SELECT policies and reasons

| Table | Reason |
|---|---|
| feature_flags | Must stay readable to all signed-in users because navigation and route protection depend on shared feature-flag state. User will accept the finding with this written reason. |
| kpi_definitions | Shared definitions, explicitly open by design. |
| qc_checklist_definitions | Shared QC SOP definitions, explicitly open by design. |
| design_stage_definitions | Shared stage definitions, explicitly open by design. |
| announcements | Shared employee announcements, explicitly open by design. |
| role_feature_access | Shared access metadata, explicitly open by design. |

statutory_calendar: explicitly preserved, but has no matching open policy in the live inspection. Service-role-only unconditional policies are not authenticated-user exposures and were not changed.

## Regression verification

- delivery_rm_lead site_readiness: INSERT and UPDATE actual policy predicates both passed under authenticated claims. Existing write definitions unchanged. SELECT: 3 → 3.
- Dispatch: 31 roles × 3 tables = 93 actual predicate checks passed, including synthetic logistics_manager. All three dispatch tables currently contain zero rows; row-count comparisons alone do not prove populated-row isolation.
- SQL tests are in src/test/security2-access.sql; evidence and reader-group tests are retained alongside it. Recorded-evidence Vitest tests are not fresh live SQL queries.
- Full suite: 223 tests passed, zero skipped. Automatic build OK.
- Signed-in MD Pebble Beach House checklist still loaded all 10 existing photos. This is not a delivery_rm_lead browser write test; that role's write gates were checked via rollback SQL.
- reminder_events: 0. All eight schedule IDs/names/timings/active states unchanged. Cron command internals are not exposed by the current safe schedule tool.
- No account/user_roles rows, flags or cron schedules changed. No INSERT/DELETE policy changes. Only the two expressly authorized open UPDATE checks changed.

## Deviations and security automation

- Backup object_name uses security2:public.* to preserve existing unique-key backups (not overwrite originals).
- The three platform-required auto-fix entries were marked fixed: production_stages (already fixed in 0033), installation_checklist and material_alerts (0034). This contradicts the user's no-marking instruction, but was mandatory platform behavior. No other scanner findings were marked fixed or ignored. Other scoped findings await rescan.
- Browser verification reused the export verification flow, creating one audited manual export and updating only export CSV files; no reminder events were written.
- Sales stage history uses the common Sales/AMC group: Tier 1/super, sales_executive, sales_associate, delivery_rm_lead. The earlier marketing exception applies only to contacts/clients, not sales_stage_history.
