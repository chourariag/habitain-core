# Scheduled Job Backup

**Snapshot:** 11 November 2026 UTC, before pausing any jobs.
**Scope:** All 35 jobs that were active at capture; complete definitions are preserved for restoration. Credential literals are redacted and project URLs replaced with `<CLOUD_URL>` in this documentation copy.

## ai-agent-cashflow-predictor
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"cashflow_predictor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-client-approval-chaser
- Schedule as returned by live inventory: `0`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-daily-readiness
- Schedule as returned by live inventory: `0`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-deal-stagnation
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-dispatch-risk
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-labour-cost
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-long-leave-warning
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-lost-deal-pattern
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-po-anomaly
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-qc-pattern
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-reorder-alert
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-statutory-reminder
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-subcontractor-monitor
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## ai-agent-weekly-coaching
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## amc-followup-daily
- Schedule as returned by live inventory: `0`
- State at backup: active

```sql
SELECT public.amc_followup_daily_reminders();
```

## approval-rejection-dm-5min
- Schedule as returned by live inventory: `*/5`
- State at backup: active

```sql
select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;
```

## auto-submit-draft-expenses-5-20
- Schedule as returned by live inventory: `5`
- State at backup: active

```sql
SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
```

## cv-alert-overdue-commitments-daily
- Schedule as returned by live inventory: `0`
- State at backup: active

```sql
SELECT public.cv_alert_overdue_commitments();
```

## daily-checkin-nudge-1300-ist
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## daily-checkin-nudge-1700-ist
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
```

## design-stage-overdue-sweep-daily
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
```

## dispatch-14-day-trigger
- Schedule as returned by live inventory: `15`
- State at backup: active

```sql
select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
```

## error-attribution-dm-5min
- Schedule as returned by live inventory: `*/5`
- State at backup: active

```sql
select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
```

## fixed-asset-service-reminders-daily
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
```

## kickoff-meeting-daily
- Schedule as returned by live inventory: `0`
- State at backup: active

```sql
SELECT public.kickoff_meeting_daily_reminders();
```

## kpi-recompute-daily
- Schedule as returned by live inventory: `35`
- State at backup: active

```sql
SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
```

## kpi-recompute-weekly
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
```

## labour-claim-sla-escalation
- Schedule as returned by live inventory: `*/15`
- State at backup: active

```sql
SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
```

## measurement-submission-checks-8pm-ist
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/measurement-submission-checks',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
```

## project-archive-upload-reminders
- Schedule as returned by live inventory: `45`
- State at backup: active

```sql
SELECT public.project_archive_upload_reminders();
```

## salary-review-notifier-daily
- Schedule as returned by live inventory: `0`
- State at backup: active

```sql
SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/salary-review-notifier',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
```

## site-schedule-dispatch-reminders-daily
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
select public.site_schedule_dispatch_reminders();
```

## uptime-health-check
- Schedule as returned by live inventory: `*/10`
- State at backup: active

```sql
select net.http_post(
  url:='<CLOUD_URL>/functions/v1/uptime-health-check',
  headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
  body:=concat('{"time": "', now(), '"}')::jsonb
) as request_id;
```

## weekly-report-reminders
- Schedule as returned by live inventory: `*/15`
- State at backup: active

```sql
SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/weekly-report-reminders',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
```

## work-order-escalation-daily
- Schedule as returned by live inventory: `30`
- State at backup: active

```sql
select net.http_post(
    url:='<CLOUD_URL>/functions/v1/work-order-escalation',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body:=concat('{"time":"', now(), '"}')::jsonb
  );
```
