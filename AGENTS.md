# Project Engineering Rules

- Keep feature-flag reads centralized and enforce the same flag in navigation and route guards so disabled modules cannot be opened by URL.
- Multi-table project setup imports use one authenticated database RPC transaction so validation, upserts, and audit rows commit or roll back together.
- Contract-labour attendance and master changes use dedicated role- and project-checked database functions, keeping employee GPS attendance and payroll data outside the module.
- Daily site reports reuse daily_measurements (trade='daily_site_report') and write only through role- and project-checked SECURITY DEFINER RPCs, so existing measurement RLS stays untouched; construction tasks are marked by project_tasks.work_category because task_type is an existing enum.
- Daily-report elevation photos use kind='elevation' + elevation_id via add_site_report_elevation_photo; legacy fixed kinds stay valid for old rows, and project_elevations changes go only through role-checked RPCs with their own log table.
- Daily Report quantities use site_report_quantities through checked RPCs; measurement_line_items keeps its legacy boq_items foreign key so legacy sheets remain compatible.
- Legacy measurement notification triggers must return early for trade='daily_site_report' so report submission and re-submission cannot generate factory measurement alerts.
- Expense receipts live in the private expense-receipts bucket (<user_id>/<yyyy-mm>/<file>), shown via signed URLs; policy checks are stored warnings with a reason, never hard blocks, and cross-user duplicate checks go through a SECURITY DEFINER RPC so expense_entries RLS stays unchanged.
- Expense Excel template and reader share one column list (src/lib/expense-excel.ts) and the reader locates the header by the Date cell, so template and parser cannot drift.
- Reminders run in PostgreSQL only; one event per subject/level retains all role-resolved recipients in recipient_ids to preserve uniqueness while delivering one summary per recipient per run.
- Escalation limits are enforced by update_escalation_level and mirrored in reminder-validation for immediate feedback; server validation remains authoritative.
- Tier 1 business access uses TIER1_ROLES and is_tier1/is_tier1_or_super; reviewed legacy rewrites require parity2_backup originals and atomic rollback, while sensitive definitions remain excluded to preserve their review boundary.
- Edge director access mirrors frontend TIER1_ROLES in _shared/director-tier.ts with a parity test; recipient helpers deduplicate auth user IDs because role-query joins may return the same person more than once.
- External exports use a fixed versioned column manifest, service-only hourly-rate projection, and private exports bucket; dashboard tokens are hashed and audited, and can sign only latest manifest files because source credentials and unrestricted storage access must never reach clients.
- Measurement header WIP lives in finance-only daily_measurement_wip; legacy header fields remain neutral, checked writers update the private table, and service exports join it without changing the versioned CSV schema.
- Site readiness detail lives in site_readiness_checks/tolerances/crane/crane_cost with policies via can_read/can_write_site_readiness helpers mirroring site_readiness; tolerance auto-flag rules live in src/lib/site-readiness-foundation.ts and site_readiness_validate_check() and must stay in sync.
- Subcontract rates reuse labour_contractors and are written only by the Setup upload RPC (rows deactivated, never deleted); Daily Report subcontract rows snapshot rate_used/amount_inr at submit so rate edits never rewrite history, and the shared rules live in src/lib/site-report-subcontract.ts mirrored by save/submit_site_report.
