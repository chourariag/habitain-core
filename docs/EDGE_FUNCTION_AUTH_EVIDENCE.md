# Edge-function caller-authentication evidence — 21/11/2026

## Outcome
15 scoped functions deployed. All 15 returned **401** for both missing credentials and an invalid bearer: **30/30 live denial checks**. Allowed execution, 403 role/project denial, and email delivery were tested with mocks only. No allowed scheduled job, email, notification or AI execution was live-invoked.

The user explicitly confirmed preserving four legacy callbacks and their five schedules. Their findings remain open. No schedule, header, timing, name or enabled state was changed. No migration, role/account, RLS/storage, export, report, attendance or Running Bill change was made.

## Complete function-folder inventory
`_shared` is supporting code, not an endpoint. All other 38 folders are below. “Indirect” means the shared export or technical-error helper uses the service key. Caller matches from legacy schedule names are distinguished from verified managed targets.

| Function | Service key | Credential before → now | Caller found / disposition |
|---|---|---|---|
| admin-users | Yes | User JWT + checked account role → unchanged | Account-management and password screens; excluded |
| ai-agents | Yes | Own cron header or user JWT + director → unchanged | Drawings, Design Portal, procurement screens |
| approval-rejection-dm | Yes | None → unchanged/open | Legacy job name match; target/header hidden; user-approved hold |
| auto-submit-draft-expenses | Yes | None → unchanged/open | Legacy job name match; target/header hidden; user-approved hold |
| board-paper-data | Yes | User JWT + director → unchanged | Board-paper screen |
| capacity-ai-analysis | Yes | User JWT → JWT + capacity-screen role; project check if supplied | Capacity Planning; Setup capacity check |
| daily-checkin-nudge | Yes | None → unchanged/open | Two legacy job name matches; target/header hidden; user-approved hold |
| dispatch-14-day-trigger | Yes | None → generated cron auth or Tier 1/Super JWT | No current schedule/client caller found |
| error-attribution-dm | Yes | None → unchanged/open | Legacy job name match; target/header hidden; user-approved hold |
| export-admin | Indirect | User JWT + checked export role → unchanged | Settings Exports; excluded |
| export-latest | Indirect | Own hashed export token → unchanged | External dashboard/download client; excluded |
| export-nightly | Indirect | Generated cron secret → unchanged | Verified managed export schedule; excluded |
| fixed-asset-service-reminders | Yes | None → generated cron auth or Tier 1/Super JWT | No current schedule/client caller found |
| floor-plan-analyze | Yes | User JWT → JWT + stored project + floor-plan RLS-equivalent checks | FloorPlanPositionsTab |
| generate-board-paper | Yes | User JWT + director → unchanged | Board-paper screen |
| generate-project-archive | Yes | None → JWT + Tier 1/Super/Head of Projects + project access | ProjectArchive |
| kiosk-login | Yes | Own kiosk PIN flow → unchanged | Kiosk login; excluded |
| kpi-recompute | Yes | None → generated cron auth or Tier 1/Super JWT | KPI page's background invocation; no current schedule found |
| labour-claim-sla-escalation | Yes | None → generated cron auth or Tier 1/Super JWT | No current schedule/client caller found |
| measurement-submission-checks | Yes | None → generated cron auth or Tier 1/Super JWT | No current schedule/client caller found |
| photo-check | Indirect | User JWT → unchanged | PhotoGuidance |
| project-storage-cleanup | Yes | User JWT + Tier 1/Super/Head of Projects → unchanged | StorageManagementSection |
| qc-analysis | Indirect | User JWT → unchanged | QC photo workflow |
| rm-analysis | Indirect | User JWT → unchanged | R&M screen |
| salary-review-notifier | Yes | None → generated cron auth or Tier 1/Super JWT | No current schedule/client caller found |
| scan-invoice | Indirect | User JWT → unchanged | InvoiceScanner |
| send-calendar-invite | No | User JWT → JWT + kickoff roles + project access | KickoffMeetingCard |
| send-email | Yes | None → cron/service bearer OR active permitted user JWT | notifications.ts; no other function/public database sender found |
| site-photo-analyze | Yes | User JWT → JWT + stored photo project access | GuidedPhotoCapture |
| site-schedule-trigger | Yes | None → generated cron auth or Tier 1/Super JWT | No current schedule/client caller found |
| sop-generate | Yes | User JWT with action-specific checks → unchanged | SOPs screen |
| super-admin-create-user | Yes | User JWT + checked account role → unchanged | CreateAccountsTab; excluded |
| tally-ingest | Yes | Own hashed x-api-key → unchanged | External Tally ingestion client; excluded |
| tally-key-manage | Yes | User JWT + Tier 1/Super, Finance Manager status access → unchanged | TallyIngestionKeySection |
| uptime-health-check | Yes | Public monitor/no incoming credential → unchanged | Legacy uptime job name match; explicitly excluded |
| usage-nudge-check | No | Empty entrypoint → unchanged | No caller found; no executable service-key work |
| weekly-report-reminders | Yes | None → generated cron auth or Tier 1/Super JWT | No current schedule/client caller found |
| work-order-escalation | Yes | None → generated cron auth or Tier 1/Super JWT | No current schedule/client caller found |

Historical schedule descriptions exist in the repository, but are not evidence of active jobs. Public database function definitions were searched for send-email/send-calendar-invite callbacks; none matched. Existing function callers were searched for functions.invoke and direct function URLs.

## Schedule evidence
Eight rows were identical before and after (ID/name/cron/active plus available managed metadata). Expressions are UTC. **Touched schedules: none. Header changes: none.**

| ID | Name | Expression before = after | Active before = after | Target/header evidence |
|---|---|---|---|---|
| 21 | auto-submit-draft-expenses-5-20 | `5 0 5,20 * *` | true | Unmarked legacy row; exact callback/body/Authorization unavailable |
| 31 | daily-checkin-nudge-1300-ist | `30 7 * * *` | true | Unmarked legacy row; exact callback/body/Authorization unavailable |
| 32 | daily-checkin-nudge-1700-ist | `30 11 * * *` | true | Unmarked legacy row; exact callback/body/Authorization unavailable |
| 33 | approval-rejection-dm-5min | `*/5 * * * *` | true | Unmarked legacy row; exact callback/body/Authorization unavailable |
| 34 | error-attribution-dm-5min | `*/5 * * * *` | true | Unmarked legacy row; exact callback/body/Authorization unavailable |
| 35 | uptime-health-check | `*/10 * * * *` | true | Excluded; legacy target/header unavailable |
| 36 | reminders-hourly | `5 * * * *` | true | Unmarked row; SQL-only reminder architecture; callback/header not exposed |
| 37 | export-nightly-0130-ist | `0 20 * * *` | true | Managed target `export-nightly`, body `{"trigger":"scheduled"}`; generated bearer cron credential |

The supported schedule replacement interface exposes no header-only mutation for legacy rows. No HTTP schedule SQL or secret interpolation was authored. Exact legacy Authorization headers cannot be asserted; the four callbacks were preserved rather than interrupted.

## Authorization and caller compatibility
- Tier 1: managing_director, finance_director, sales_director, architecture_director; Super Admin is separate. Machine manual calls require one of these five assigned roles and an active profile.
- Archive: those five roles or head_of_projects, plus user_can_access_project.
- Photo analysis: authenticated active user; project resolved from stored photo, not the body.
- Floor-plan analysis: project resolved from floor_plan_id; user_can_access_project, can_manage_floor_plan, and the existing update policy (is_md OR manager with unlocked plan/uploader ownership).
- Capacity: production_head, head_operations, planning_engineer, four directors, super_admin. Wider Setup-only roles now have its Check Capacity button disabled; setup uploads are unchanged.
- Calendar: operations_architect, principal_architect, head_operations, four directors, super_admin. Client now sends project_id. Maximum 20 attendees; title/notes/link escaped; non-http(s) links rejected.
- KPI's existing background invocation remains fire-and-forget with its rejection caught. Non-Tier 1 users now receive 403 for recomputation; existing score reads are unchanged.
- Email's current client path uses the signed-in user's JWT. Recipients resolve server-side to profiles addresses; external recipients are denied. All user HTML is escaped, or rendered through escaped server notification templates. Internal cron/service bearer callers may retain trusted markup and external recipients. No current internal sender was found; that credential path was mocked.
- Email user-role list: four directors, super_admin, factory_floor_supervisor, site_installation_mgr, head_of_projects, operations_architect, principal_architect, finance_manager, accountant, stores_executive, quality_control_engineer, production_head, head_operations, design_estimation_engineer, planning_engineer, purchase_manager, costing_engineer, hr_manager, site_engineer, quantity_surveyor, planning_head, storekeeper, site_supervisor, site_manager, procurement_manager.
- notification_id must belong to the caller unless internally authenticated. Client sends it only for the caller's own notification; cross-recipient copies omit it, preserving delivery without allowing another person's email_sent flag to be changed.

## Test evidence
- Full suite: **504 passed, 4 skipped, 44 files passed**. One initial full run timed out in an existing permission-array scan; lower-worker rerun passed.
- New scoped tests after the final import correction: **132 passed, 4 skipped** (96 handler tests, 1 client ownership test, 35 completed repository guard assertions).
- Four skipped guard assertions are exactly the four user-approved legacy callbacks, not an allowlist. Every new unguarded function fails the guard. Existing explicit exceptions have explanatory comments: kiosk-login, tally-ingest, uptime-health-check, export-admin, export-latest, export-nightly.
- Handler tests cover missing credential 401, wrong cron credential 401, unauthorized role/project 403, mocked allowed paths, all nine manual machine fallbacks, capacity and calendar role lists, Head of Projects assignment, server-resolved project IDs, locked-plan checks, 21 attendees, invalid link, HTML escaping, external email recipient denial and notification ownership.
- Live: **30/30 denial responses were 401 across all 15 deployed functions**. No live allowed-path, role-changing test, email delivery, notification delivery or scheduled execution occurred.
- Live checks initially found six 503 startup errors caused by an SDK CORS export/version collision. The shared helper's client import was corrected, all 15 redeployed, and all 30 denial checks then passed.
- Latest preview build: OK. reminder_events before and after: **0**.

## Remaining / unverified
Four legacy findings remain open per explicit user confirmation. Their exact headers/targets are hidden and need supported migration capability before tightening. Allowed live job/email/AI execution and physical client flows were intentionally not tested. Existing excluded endpoints and other findings were not remediated or rescanned as a bulk operation.

Publish > Update to release the three client changes. Function changes are already deployed.
