# PARITY-2A verification

Migration: `0029_parity2a_legacy_director_tier.sql`.

A changed: **319** (270 policies, 49 functions). B covered: **213**. C pending: **7**. D pending: **0**. Backup rows: **319**.

Post-apply live definition comparison confirmed every A changed and every B/C/D stayed identical.

## Authenticated smoke test

Existing accounts were impersonated with SET LOCAL request.jwt.claims and SET LOCAL ROLE authenticated, inside rolled-back transactions. No account or role rows changed.

| Table | MD | Sales Director | Architecture Director |
|---|---:|---:|---:|
| projects | 6 | 6 | 6 |
| project_tasks | 924 | 924 | 924 |
| purchase_orders | 0 | 0 | 0 |
| qc_inspections | 1 | 1 | 1 |
| panels | 0 | 0 | 0 |
| expense_entries | 10 | 10 | 10 |

Zero-row purchase orders and panels checks verify equal visibility, not non-empty access.

## Unchanged controls

- reminder_events: 0; Reminders OFF.
- cron.job full-row hash before/after: `5fa88816f225db296e602ad722f1babf`.
- Level 3: daily_site_report 48h; labour_attendance 48h; expense_receipt 72h.

| Job | Schedule |
|---|---|
| auto-submit-draft-expenses-5-20 | 5 0 5,20 * * |
| daily-checkin-nudge-1300-ist | 30 7 * * * |
| daily-checkin-nudge-1700-ist | 30 11 * * * |
| approval-rejection-dm-5min | */5 * * * * |
| error-attribution-dm-5min | */5 * * * * |
| uptime-health-check | */10 * * * * |
| reminders-hourly | 5 * * * * |

## Boundaries and deviations

- Sensitive definitions unchanged; shared-helper parity can widen inherited access without changing consumer definitions.
- B counts include direct complete four-role lists as well as Tier-helper-mediated objects.
- Rollback is Super Admin-only, restores all 319 backed-up definitions, and keeps the backup table. The separate 48-hour data correction is not rolled back.
- Notification recipients are deduplicated in SELECT projections; no live notification-trigger action was executed.
- Existing super_admin, chairman, and other role terms are preserved. Chairman is not added to Tier 1.
- Historical audit remains unchanged; live classification and source mapping are in TIER1_PARITY_PENDING.md.
