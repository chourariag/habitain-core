CREATE OR REPLACE FUNCTION public.get_scheduled_job_status()
RETURNS TABLE(job_name text, schedule text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT known.job_name, known.schedule, EXISTS (
    SELECT 1 FROM cron.job AS scheduled
    WHERE scheduled.jobname = known.job_name AND scheduled.active
  ) AS active
  FROM (VALUES
    ('ai-agent-cashflow-predictor', '30 14 * * 0'),
    ('ai-agent-client-approval-chaser', '0 4 * * *'),
    ('ai-agent-daily-readiness', '0 2 * * 1-5'),
    ('ai-agent-deal-stagnation', '30 3 * * *'),
    ('ai-agent-dispatch-risk', '30 2 * * *'),
    ('ai-agent-labour-cost', '30 12 * * 5'),
    ('ai-agent-long-leave-warning', '30 13 * * 0'),
    ('ai-agent-lost-deal-pattern', '30 1 1,15 * *'),
    ('ai-agent-po-anomaly', '30 4 * * *'),
    ('ai-agent-qc-pattern', '30 1 * * 1'),
    ('ai-agent-reorder-alert', '30 1 * * 1'),
    ('ai-agent-statutory-reminder', '30 2 * * *'),
    ('ai-agent-subcontractor-monitor', '30 3 * * *'),
    ('ai-agent-weekly-coaching', '30 1 * * 1'),
    ('amc-followup-daily', '0 9 * * *'),
    ('approval-rejection-dm-5min', '*/5 * * * *'),
    ('auto-submit-draft-expenses-5-20', '5 0 5,20 * *'),
    ('cv-alert-overdue-commitments-daily', '0 9 * * *'),
    ('daily-checkin-nudge-1300-ist', '30 7 * * *'),
    ('daily-checkin-nudge-1700-ist', '30 11 * * *'),
    ('design-stage-overdue-sweep-daily', '30 2 * * *'),
    ('dispatch-14-day-trigger', '15 2 * * *'),
    ('error-attribution-dm-5min', '*/5 * * * *'),
    ('fixed-asset-service-reminders-daily', '30 0 * * *'),
    ('kickoff-meeting-daily', '0 9 * * *'),
    ('kpi-recompute-daily', '35 18 * * *'),
    ('kpi-recompute-weekly', '30 2 * * 1'),
    ('labour-claim-sla-escalation', '*/15 * * * *'),
    ('measurement-submission-checks-8pm-ist', '30 14 * * *'),
    ('project-archive-upload-reminders', '45 9 * * *'),
    ('salary-review-notifier-daily', '0 3 * * *'),
    ('site-schedule-dispatch-reminders-daily', '30 3 * * *'),
    ('uptime-health-check', '*/10 * * * *'),
    ('weekly-report-reminders', '*/15 * * * *'),
    ('work-order-escalation-daily', '30 3 * * *')
  ) AS known(job_name, schedule)
  WHERE public.has_role(auth.uid(), 'super_admin'::public.app_role)
     OR public.has_role(auth.uid(), 'managing_director'::public.app_role)
  ORDER BY known.job_name;
$$;
REVOKE ALL ON FUNCTION public.get_scheduled_job_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_scheduled_job_status() TO authenticated, service_role;