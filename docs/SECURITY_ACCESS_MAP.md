# SECURITY-1 Access Map

## Live inspection

Inspected live public policies, active profile role coverage, storage bucket configuration, scanner findings and source references. No database, storage, scanner, account, role, flag, or scheduler changes have been made.

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

## Required pre-commit safety-check blocker

No active auth-linked profile exists for sales_associate, quantity_surveyor, or procurement_assistant. All other named group roles and stores_executive have an active user. Testing one active user of EACH requested role is therefore impossible without changing accounts, which is forbidden. No migration has been applied. A decision is needed: test missing roles synthetically with transaction-local helper substitutes (no account/role-row changes), or wait for legitimate active users in these roles. Synthetic checks are not equivalent to testing real users and must be explicitly approved.

## site-photos

storage.buckets.public = false. Already private; no bucket change required. Existing helper src/lib/storage-signed-url.ts defaults to 3600 seconds and handles stored paths plus legacy URLs. Screenshot verification has not been run.

### Public-link source references

- `src/lib/storage-signed-url.ts:7` — `* `getPublicUrl()` returns a link that 400s for anyone without an active`
- `src/pages/DesignPortal.tsx:377` — `photoUrl = supabase.storage.from("site-photos").getPublicUrl(path).data.publicUrl;`
- `src/pages/DesignPortal.tsx:382` — `voiceUrl = supabase.storage.from("voice-notes").getPublicUrl(path).data.publicUrl;`
- `src/pages/DesignPortal.tsx:453` — `attachmentUrl = supabase.storage.from("drawings").getPublicUrl(path).data.publicUrl;`
- `src/pages/DesignPortal.tsx:524` — `const { data: urlData } = supabase.storage.from("drawings").getPublicUrl(path);`
- `src/pages/DispatchPackForm.tsx:89` — `const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;`
- `src/pages/Drawings.tsx:202` — `const { data: urlData } = supabase.storage.from("drawings").getPublicUrl(path);`
- `src/pages/Drawings.tsx:271` — `photoUrl = supabase.storage.from("site-photos").getPublicUrl(path).data.publicUrl;`
- `src/pages/Drawings.tsx:276` — `voiceUrl = supabase.storage.from("voice-notes").getPublicUrl(path).data.publicUrl;`
- `src/pages/Profile.tsx:114` — `const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);`
- `src/components/dispatch/DispatchPackFormV2.tsx:108` — `const url = supabase.storage.from("site-photos").getPublicUrl(path).data.publicUrl;`
- `src/components/drawings/ModuleDrawingsTab.tsx:100` — `photoUrl = supabase.storage.from("site-photos").getPublicUrl(path).data.publicUrl;`
- `src/components/production/SupervisorDailyLog.tsx:89` — `const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);`
- `src/components/site/GuidedPhotoCapture.tsx:102` — `const { data: pub } = supabase.storage.from("site-photos").getPublicUrl(path);`
- `src/components/site/HandoverPack.tsx:111` — `const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);`
- `src/components/site/InstallationChecklist.tsx:88` — `const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);`
- `src/components/site/PunchListModule.tsx:76` — `const { data } = supabase.storage.from("site-photos").getPublicUrl(path);`
- `src/components/site/SiteDiary.tsx:126` — `const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);`
- `src/components/site/SiteFactoryFeedback.tsx:85` — `const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);`
- `src/components/site/SiteReceiptChecklist.tsx:68` — `const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);`

## WIP dependency inventory

- Explicit application read: src/components/production/FactoryMeasurementSheet.tsx:74 (also writes total_wip_today at line 201).
- Export manifest: supabase/functions/_shared/export-schema.ts:169,181,185; consumed by supabase/functions/export-nightly/index.ts:41.
- Generated declarations: src/integrations/supabase/types.ts (not a runtime reader).
- Live SQL readers/writers: apply_record_edit and submit_site_report. The former updates review flags and recalculates totals; the latter writes totals/review flags during submission.
- Runtime explicit read/export path: 3 files, under the five-file threshold. WIP has NOT been moved while the required migration safety decision is pending.

## Active scanner findings

52 live database findings; zero dependency findings returned. None were marked resolved. Full scanner list below:

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
- Next available migration number: 0033; not created/applied.
- Existing five credential-dependent site-readiness tests have not been replaced yet.
