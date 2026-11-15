# P7 Reminders — rollout confirmation

## Inspection (8 lines)
1. Notifications: recipient_id, type/content, linked_entity_type/id, is_read, created_at, title/body, category, navigate_to, read_at, related_table/id, email_sent/at, priority (18 columns).
2. Project team membership: id, project_id, profile_id, role (text), access_level, assigned_by/at, is_active, created_at/updated_at; project roles are stored per active assignment.
3. Profiles have reporting_manager_id and secondary_manager_id; reminders resolve project roles, not reporting-manager names.
4. Flags inspected: reminders was ON before P7; projects, attendance, expenses, labour, site_report, project_setup, procurement, exports and user_admin also ON; remaining rows recorded by the existing Modules screen.
5. docs/CRON_BACKUP.md contains the prior job definitions; no previous definition was changed.
6. Before P7, six jobs were scheduled: approval-rejection-dm-5min, auto-submit-draft-expenses-5-20, daily-checkin-nudge-1300-ist, daily-checkin-nudge-1700-ist, error-attribution-dm-5min, uptime-health-check.
7. pg_cron and pg_net are enabled. P7 uses PostgreSQL only, no Edge Functions.
8. P7 adds one hourly SQL job; reminder flag is now OFF and every rule is Shadow.

## Applied change

`drizzle/migrations/0024_p7_shadow_reminders.sql`.
Rule/default data was seeded separately from the schema migration. The existing Reminders flag was switched OFF.

```sql
SELECT cron.schedule('reminders-hourly', '5 * * * *', $$SELECT public.run_reminders(false);$$);
```

24 checks per day, at minute 5 UTC. Maximum normal scheduling delay: one hour. While OFF the function immediately returns without writes.

| Scheduled job after P7 | UTC schedule |
|---|---|
| approval-rejection-dm-5min | */5 * * * * |
| auto-submit-draft-expenses-5-20 | 5 0 5,20 * * |
| daily-checkin-nudge-1300-ist | 30 7 * * * |
| daily-checkin-nudge-1700-ist | 30 11 * * * |
| error-attribution-dm-5min | */5 * * * * |
| reminders-hourly | 5 * * * * |
| uptime-health-check | */10 * * * * |

## Missing subject SQL

Both project rules require a non-archived project with a non-null status other than completed, closed, cancelled/canceled, archived, on_hold or inactive, and this expectation predicate:

```sql
EXISTS (
 SELECT 1 FROM public.project_tasks t
 WHERE t.project_id=p.id AND t.work_category='construction'
 AND ((t.completion_percentage>0 AND t.completion_percentage<100)
      OR (t.planned_start_date<=p_date AND t.planned_finish_date>=p_date))
)
OR EXISTS (
 SELECT 1 FROM public.labour_attendance a
 WHERE a.project_id=p.id AND a.work_date=p_date
)
```

For configured IST working days, after the configured due time (18:30 report, 17:00 attendance):

```sql
-- Daily report missing
NOT EXISTS (
 SELECT 1 FROM public.daily_measurements m
 WHERE m.project_id=d.id AND m.measurement_date=d.report_day
 AND m.trade='daily_site_report' AND m.report_status='submitted'
 AND NOT m.is_archived
)
-- Attendance missing
NOT EXISTS (
 SELECT 1 FROM public.labour_attendance a
 WHERE a.project_id=d.id AND a.work_date=d.report_day
)
-- Receipt missing, checked on configured working days
nullif(btrim(e.receipt_path),'') IS NULL
AND nullif(btrim(e.receipt_url),'') IS NULL
AND e.status<>'rejected'
AND e.created_at+interval '48 hours'<=p_now
```

## Real dry run

Signed in as the requesting account, opened Settings, clicked **Run now (dry run)**, and called `run_reminders(true)` after confirming **Test project - 1** exists.

```json
{"project":"Test project - 1","dry_run":[],"error":null}
```

This empty result is required because the flag is OFF. No flag was temporarily enabled and no reminder or notification was created for this check.
The screen displayed “Reminders are Off. Nothing would be raised.” At 360px it had no horizontal overflow.

## Assumptions and differences

- Active status is interpreted by excluding terminal, paused and inactive status keys listed above; no project status or existing policy was changed.
- Date enumeration starts at the earliest construction planned start or labour attendance date, through today; historical expectations use the current task state. Old missing working days can therefore enter shadow mode when enabled.
- All elapsed, previously unraised levels are recorded, rather than only the highest elapsed level.
- The unique event key stays `(rule_key, subject_ref, level)`. Additional recipient_ids and per-person acknowledgements preserve multiple assigned recipients without duplicate event rows; notified_user stores the first recipient.
- A project-specific escalation with no matching active project assignment is recorded as `(unassigned)`, even if someone has that company-wide role. Projectless expenses use company-wide user_roles for escalation recipients.
- Expense age uses created_at, not entry_date. Its due-time display is 00:00; the actual due instant is created_at + 48 hours.
- Added a small reminder_change_log to retain actor/time/old/new for rule edits and acknowledgements.
- MD sees read-only rule controls as specified by the Super Admin-only edit requirement. Open reminders are also included in Alerts for oversight roles and addressed recipients when enabled.
- Live delivery, event creation, subsequent automatic resolution and acknowledgement were not exercised against live data because rollout must remain OFF/Shadow. SQL regression checks cover their gating and deduplication.
- Existing jobs, employee check-in, measurement triggers, existing notifications and existing RLS policies were unchanged. Security findings were not marked resolved.

Next: **Publish > Update**.