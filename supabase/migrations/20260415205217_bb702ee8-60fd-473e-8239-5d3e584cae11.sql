
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Agent 1: QC Pattern Analyst — Monday 7am IST (1:30 UTC)
SELECT cron.schedule(
  'ai-agent-qc-pattern',
  '30 1 * * 1',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"qc_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 2: Daily Readiness Brief — weekdays 7:30am IST (2:00 UTC)
SELECT cron.schedule(
  'ai-agent-daily-readiness',
  '0 2 * * 1-5',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"daily_readiness"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 3: Labour Cost Variance — Friday 6pm IST (12:30 UTC)
SELECT cron.schedule(
  'ai-agent-labour-cost',
  '30 12 * * 5',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"labour_cost"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 4: Dispatch Risk Predictor — daily 8am IST (2:30 UTC)
SELECT cron.schedule(
  'ai-agent-dispatch-risk',
  '30 2 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"dispatch_risk"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
