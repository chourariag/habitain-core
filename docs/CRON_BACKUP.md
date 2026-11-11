# Scheduled Job Backup

**Snapshot:** 11 November 2026 UTC, before pausing any jobs.
**Scope:** All 35 active jobs, with their complete definitions and UTC schedules preserved for restoration. Credential literals are redacted and project URLs are replaced with `<CLOUD_URL>` in this documentation copy.

## ai-agent-cashflow-predictor
- Schedule (UTC): `30 14 * * 0`
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
- Schedule (UTC): `0 4 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
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
- Schedule (UTC): `0 2 * * 1-5`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
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
- Schedule (UTC): `30 3 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
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
- Schedule (UTC): `30 2 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
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
- Schedule (UTC): `30 12 * * 5`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
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
- Schedule (UTC): `30 13 * * 0`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
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
- Schedule (UTC): `30 1 1,15 * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
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
- Schedule (UTC): `30 4 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
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
- Schedule (UTC): `30 1 * * 1`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
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
- Schedule (UTC): `30 1 * * 1`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
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
- Schedule (UTC): `30 2 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
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
- Schedule (UTC): `30 3 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
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
- Schedule (UTC): `30 1 * * 1`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
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
- Schedule (UTC): `0 9 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();
```

## approval-rejection-dm-5min
- Schedule (UTC): `*/5 * * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;
```

## auto-submit-draft-expenses-5-20
- Schedule (UTC): `5 0 5,20 * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
```

## cv-alert-overdue-commitments-daily
- Schedule (UTC): `0 9 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments();
```

## daily-checkin-nudge-1300-ist
- Schedule (UTC): `30 7 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
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
- Schedule (UTC): `30 11 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
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
- Schedule (UTC): `30 2 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
```

## dispatch-14-day-trigger
- Schedule (UTC): `15 2 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
```

## error-attribution-dm-5min
- Schedule (UTC): `*/5 * * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
```

## fixed-asset-service-reminders-daily
- Schedule (UTC): `30 0 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
```

## kickoff-meeting-daily
- Schedule (UTC): `0 9 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();
```

## kpi-recompute-daily
- Schedule (UTC): `35 18 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
```

## kpi-recompute-weekly
- Schedule (UTC): `30 2 * * 1`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
```

## labour-claim-sla-escalation
- Schedule (UTC): `*/15 * * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-weekly schedule:30 2 * * 1] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
```

## measurement-submission-checks-8pm-ist
- Schedule (UTC): `30 14 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-weekly schedule:30 2 * * 1] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
   jobname:labour-claim-sla-escalation schedule:*/15 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/measurement-submission-checks',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
```

## project-archive-upload-reminders
- Schedule (UTC): `45 9 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-weekly schedule:30 2 * * 1] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
   jobname:labour-claim-sla-escalation schedule:*/15 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/measurement-submission-checks',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
   jobname:measurement-submission-checks-8pm-ist schedule:30 14 * * *] map[active:true command: SELECT public.project_archive_upload_reminders();
```

## salary-review-notifier-daily
- Schedule (UTC): `0 3 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-weekly schedule:30 2 * * 1] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
   jobname:labour-claim-sla-escalation schedule:*/15 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/measurement-submission-checks',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
   jobname:measurement-submission-checks-8pm-ist schedule:30 14 * * *] map[active:true command: SELECT public.project_archive_upload_reminders();  jobname:project-archive-upload-reminders schedule:45 9 * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/salary-review-notifier',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
```

## site-schedule-dispatch-reminders-daily
- Schedule (UTC): `30 3 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-weekly schedule:30 2 * * 1] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
   jobname:labour-claim-sla-escalation schedule:*/15 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/measurement-submission-checks',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
   jobname:measurement-submission-checks-8pm-ist schedule:30 14 * * *] map[active:true command: SELECT public.project_archive_upload_reminders();  jobname:project-archive-upload-reminders schedule:45 9 * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/salary-review-notifier',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
   jobname:salary-review-notifier-daily schedule:0 3 * * *] map[active:true command: select public.site_schedule_dispatch_reminders();
```

## uptime-health-check
- Schedule (UTC): `*/10 * * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-weekly schedule:30 2 * * 1] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
   jobname:labour-claim-sla-escalation schedule:*/15 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/measurement-submission-checks',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
   jobname:measurement-submission-checks-8pm-ist schedule:30 14 * * *] map[active:true command: SELECT public.project_archive_upload_reminders();  jobname:project-archive-upload-reminders schedule:45 9 * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/salary-review-notifier',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
   jobname:salary-review-notifier-daily schedule:0 3 * * *] map[active:true command: select public.site_schedule_dispatch_reminders();  jobname:site-schedule-dispatch-reminders-daily schedule:30 3 * * *] map[active:true command:
select net.http_post(
  url:='<CLOUD_URL>/functions/v1/uptime-health-check',
  headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
  body:=concat('{"time": "', now(), '"}')::jsonb
) as request_id;
```

## weekly-report-reminders
- Schedule (UTC): `*/15 * * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-weekly schedule:30 2 * * 1] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
   jobname:labour-claim-sla-escalation schedule:*/15 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/measurement-submission-checks',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
   jobname:measurement-submission-checks-8pm-ist schedule:30 14 * * *] map[active:true command: SELECT public.project_archive_upload_reminders();  jobname:project-archive-upload-reminders schedule:45 9 * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/salary-review-notifier',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
   jobname:salary-review-notifier-daily schedule:0 3 * * *] map[active:true command: select public.site_schedule_dispatch_reminders();  jobname:site-schedule-dispatch-reminders-daily schedule:30 3 * * *] map[active:true command:
select net.http_post(
  url:='<CLOUD_URL>/functions/v1/uptime-health-check',
  headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
  body:=concat('{"time": "', now(), '"}')::jsonb
) as request_id;
 jobname:uptime-health-check schedule:*/10 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/weekly-report-reminders',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
```

## work-order-escalation-daily
- Schedule (UTC): `30 3 * * *`
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
   jobname:ai-agent-cashflow-predictor schedule:30 14 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-client-approval-chaser schedule:0 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-daily-readiness schedule:0 2 * * 1-5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-deal-stagnation schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-dispatch-risk schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-labour-cost schedule:30 12 * * 5] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-long-leave-warning schedule:30 13 * * 0] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-lost-deal-pattern schedule:30 1 1,15 * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-po-anomaly schedule:30 4 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-qc-pattern schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-reorder-alert schedule:30 1 * * 1] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-statutory-reminder schedule:30 2 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-subcontractor-monitor schedule:30 3 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:ai-agent-weekly-coaching schedule:30 1 * * 1] map[active:true command: SELECT public.amc_followup_daily_reminders();  jobname:amc-followup-daily schedule:0 9 * * *] map[active:true command: select net.http_post(url:='<CLOUD_URL>/functions/v1/approval-rejection-dm', headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb, body:=concat('{"time":"', now(), '"}')::jsonb) as request_id;  jobname:approval-rejection-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/auto-submit-draft-expenses',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:auto-submit-draft-expenses-5-20 schedule:5 0 5,20 * *] map[active:true command:SELECT public.cv_alert_overdue_commitments(); jobname:cv-alert-overdue-commitments-daily schedule:0 9 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1300-ist schedule:30 7 * * *] map[active:true command:
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-checkin-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
   jobname:daily-checkin-nudge-1700-ist schedule:30 11 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/design-stage-overdue-sweep',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"scheduled_at":"', now(), '"}')::jsonb
  ) AS request_id;
   jobname:design-stage-overdue-sweep-daily schedule:30 2 * * *] map[active:true command:
  select net.http_post(
    url := '<CLOUD_URL>/functions/v1/dispatch-14-day-trigger',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:dispatch-14-day-trigger schedule:15 2 * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/error-attribution-dm',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
   jobname:error-attribution-dm-5min schedule:*/5 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/fixed-asset-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  );
   jobname:fixed-asset-service-reminders-daily schedule:30 0 * * *] map[active:true command: SELECT public.kickoff_meeting_daily_reminders();  jobname:kickoff-meeting-daily schedule:0 9 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=daily',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-daily schedule:35 18 * * *] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/kpi-recompute?mode=weekly',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
 jobname:kpi-recompute-weekly schedule:30 2 * * 1] map[active:true command:
  SELECT net.http_post(
    url:='<CLOUD_URL>/functions/v1/labour-claim-sla-escalation',
    headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
    body:='{}'::jsonb
  );
   jobname:labour-claim-sla-escalation schedule:*/15 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/measurement-submission-checks',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
   jobname:measurement-submission-checks-8pm-ist schedule:30 14 * * *] map[active:true command: SELECT public.project_archive_upload_reminders();  jobname:project-archive-upload-reminders schedule:45 9 * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/salary-review-notifier',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
   jobname:salary-review-notifier-daily schedule:0 3 * * *] map[active:true command: select public.site_schedule_dispatch_reminders();  jobname:site-schedule-dispatch-reminders-daily schedule:30 3 * * *] map[active:true command:
select net.http_post(
  url:='<CLOUD_URL>/functions/v1/uptime-health-check',
  headers:='{"Content-Type": "application/json", "apikey": "[REDACTED]"}'::jsonb,
  body:=concat('{"time": "', now(), '"}')::jsonb
) as request_id;
 jobname:uptime-health-check schedule:*/10 * * * *] map[active:true command:
  SELECT net.http_post(
    url := '<CLOUD_URL>/functions/v1/weekly-report-reminders',
    headers := '{"Content-Type":"application/json","apikey":"[REDACTED]"}'::jsonb,
    body := '{}'::jsonb
  );
   jobname:weekly-report-reminders schedule:*/15 * * * *] map[active:true command:
  select net.http_post(
    url:='<CLOUD_URL>/functions/v1/work-order-escalation',
    headers:='{"Content-Type":"application/json","apikey":"[REDACTED]","Authorization":"Bearer [REDACTED]"}'::jsonb,
    body:=concat('{"time":"', now(), '"}')::jsonb
  );
```
