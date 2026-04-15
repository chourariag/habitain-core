
-- Agent 13: Lost Deal Pattern Analyst — 1st and 15th at 7am IST (1:30 UTC)
SELECT cron.schedule(
  'ai-agent-lost-deal-pattern',
  '30 1 1,15 * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"lost_deal_pattern"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 14: Deal Stagnation Alert — daily 9am IST (3:30 UTC)
SELECT cron.schedule(
  'ai-agent-deal-stagnation',
  '30 3 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"deal_stagnation"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 15: Weekly Coaching Digest — Monday 7am IST (1:30 UTC)
SELECT cron.schedule(
  'ai-agent-weekly-coaching',
  '30 1 * * 1',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"weekly_coaching"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 16: Long Leave Early Warning — Sunday 7pm IST (13:30 UTC)
SELECT cron.schedule(
  'ai-agent-long-leave-warning',
  '30 13 * * 0',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"long_leave_warning"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
