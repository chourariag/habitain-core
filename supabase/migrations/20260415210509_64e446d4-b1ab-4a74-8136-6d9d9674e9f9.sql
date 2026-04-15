
-- Agent 9: Reorder Alert — Monday 7am IST (1:30 UTC)
SELECT cron.schedule(
  'ai-agent-reorder-alert',
  '30 1 * * 1',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"reorder_alert"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 10: PO Anomaly Detector — daily 10am IST (4:30 UTC)
SELECT cron.schedule(
  'ai-agent-po-anomaly',
  '30 4 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"po_anomaly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 11: Cash Flow Predictor — Sunday 8pm IST (14:30 UTC)
SELECT cron.schedule(
  'ai-agent-cashflow-predictor',
  '30 14 * * 0',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"cashflow_predictor"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Agent 12: Statutory Reminder — daily 8am IST (2:30 UTC)
SELECT cron.schedule(
  'ai-agent-statutory-reminder',
  '30 2 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-agents',
    body := '{"agent":"statutory_reminder"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
