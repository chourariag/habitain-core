
-- Agent 5: Sub-Contractor Monitor — daily 9am IST (3:30 UTC)
SELECT cron.schedule(
  'ai-agent-subcontractor-monitor',
  '30 3 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"subcontractor_monitor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 7: Client Approval Chaser — daily 9:30am IST (4:00 UTC)
SELECT cron.schedule(
  'ai-agent-client-approval-chaser',
  '0 4 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"client_approval_chaser"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
