CREATE OR REPLACE FUNCTION public.can_view_running_bill(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public.is_tier1_or_super(_uid)
    OR COALESCE(public.get_user_role(_uid)::text IN ('finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer'), false))
$$;

CREATE OR REPLACE FUNCTION public.get_running_bill(p_project_id uuid, p_as_of date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_boq uuid; v jsonb;
BEGIN
  IF NOT public.can_view_running_bill(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to view the running bill' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_boq FROM public.project_boq WHERE project_id = p_project_id ORDER BY version_number DESC, uploaded_at DESC LIMIT 1;

  WITH rpt AS (
    SELECT id, measurement_date FROM public.daily_measurements
    WHERE project_id = p_project_id AND trade = 'daily_site_report' AND report_status = 'submitted'
      AND COALESCE(is_archived, false) = false AND measurement_date <= p_as_of
  ),
  q AS (SELECT s.* FROM public.site_report_quantities s JOIN rpt ON rpt.id = s.report_id),
  qa AS (
    SELECT boq_item_id, sum(today_qty) qty, sum(today_qty) FILTER (WHERE contractor_id IS NULL) own_qty,
           sum(today_qty) FILTER (WHERE contractor_id IS NOT NULL) sub_qty
    FROM q WHERE boq_item_id IS NOT NULL GROUP BY boq_item_id
  ),
  items AS (
    SELECT b.id, b.sno, b.item_description, b.unit, b.boq_qty, b.boq_rate FROM public.project_boq_items b
    WHERE b.boq_id = v_boq OR b.id IN (SELECT boq_item_id FROM qa)
  ),
  work AS (
    SELECT i.sno, i.item_description, i.unit, COALESCE(i.boq_qty,0) boq_qty, COALESCE(qa.qty,0) qty, COALESCE(qa.own_qty,0) own_qty,
      COALESCE(qa.sub_qty,0) sub_qty, CASE WHEN COALESCE(i.boq_qty,0) > 0 THEN round(COALESCE(qa.qty,0) / i.boq_qty * 100, 1) END pct_done,
      COALESCE(i.boq_rate,0) boq_rate, round(COALESCE(qa.qty,0) * COALESCE(i.boq_rate,0), 2) value
    FROM items i LEFT JOIN qa ON qa.boq_item_id = i.id
  ),
  att AS (
    SELECT a.work_date, a.worker_id, a.hours, w.contractor_id,
      round(a.hours * COALESCE(comp.hourly_rate, comp.monthly_salary / 208, 0), 2) amount
    FROM public.labour_attendance a
    JOIN public.labour_workers w ON w.id = a.worker_id
    LEFT JOIN public.labour_worker_compensation comp ON comp.worker_id = a.worker_id
    WHERE a.project_id = p_project_id AND a.hours > 0 AND a.work_date IN (SELECT measurement_date FROM rpt)
  ),
  bday AS (SELECT work_date, count(DISTINCT worker_id) workers, sum(hours) hours, sum(amount) amount FROM att GROUP BY work_date),
  bcon AS (
    SELECT COALESCE(c.company_name, 'Direct') contractor, count(DISTINCT att.worker_id) workers, sum(att.hours) hours, sum(att.amount) amount
    FROM att LEFT JOIN public.labour_contractors c ON c.id = att.contractor_id GROUP BY 1
  ),
  th AS (
    SELECT rpt.measurement_date d, l.task_id, sum(l.hours) h FROM public.site_report_labour l JOIN rpt ON rpt.id = l.report_id
    WHERE l.hours > 0 GROUP BY 1, 2
  ),
  tht AS (SELECT d, sum(h) total FROM th GROUP BY d),
  alloc AS (
    SELECT t.task_id, bday.amount * th.h / tht.total amt, th.h FROM bday JOIN th ON th.d = bday.work_date JOIN tht ON tht.d = bday.work_date
    JOIN (SELECT DISTINCT task_id FROM th) t ON t.task_id = th.task_id
    UNION ALL
    SELECT NULL, bday.amount, 0 FROM bday WHERE NOT EXISTS (SELECT 1 FROM tht WHERE tht.d = bday.work_date)
  ),
  btask AS (
    SELECT COALESCE(pt.task_id_in_schedule, '') code, COALESCE(pt.task_name, 'Unallocated') task, sum(alloc.h) task_hours, round(sum(alloc.amt), 2) amount
    FROM alloc LEFT JOIN public.project_tasks pt ON pt.id = alloc.task_id GROUP BY 1, 2
  ),
  sub AS (
    SELECT c.company_name contractor, COALESCE(b.sno::text, '') boq_code,
      COALESCE(b.item_description, q.extra_work_description, r.work_description) item,
      COALESCE(r.unit, q.unit, b.unit) unit, r.rate_type, sum(q.today_qty) qty,
      CASE WHEN count(DISTINCT q.rate_used) = 1 THEN max(q.rate_used) ELSE round(sum(q.amount_inr) / NULLIF(sum(q.today_qty), 0), 4) END rate_used,
      sum(COALESCE(q.amount_inr, 0)) amount, r.lump_sum_inr lump_sum, r.package_qty,
      CASE WHEN r.rate_type = 'lump_sum' AND r.lump_sum_inr > 0 THEN round(sum(COALESCE(q.amount_inr,0)) / r.lump_sum_inr * 100, 1) END pct_consumed
    FROM q JOIN public.labour_contractors c ON c.id = q.contractor_id
    LEFT JOIN public.subcontract_rates r ON r.id = q.rate_id
    LEFT JOIN public.project_boq_items b ON b.id = q.boq_item_id
    WHERE q.contractor_id IS NOT NULL AND q.today_qty > 0
    GROUP BY c.company_name, b.sno, b.item_description, q.extra_work_description, r.work_description, r.unit, q.unit, b.unit, r.rate_type, r.lump_sum_inr, r.package_qty, r.id
  )
  SELECT jsonb_build_object(
    'as_of', p_as_of,
    'reports', (SELECT count(*) FROM rpt),
    'work', COALESCE((SELECT jsonb_agg(to_jsonb(work) ORDER BY work.sno) FROM work), '[]'),
    'labour_by_day', COALESCE((SELECT jsonb_agg(jsonb_build_object('work_date', work_date, 'workers', workers, 'hours', hours, 'amount', amount,
        'cumulative', cum) ORDER BY work_date) FROM (SELECT *, sum(amount) OVER (ORDER BY work_date) cum FROM bday) x), '[]'),
    'labour_by_contractor', COALESCE((SELECT jsonb_agg(to_jsonb(bcon) ORDER BY contractor) FROM bcon), '[]'),
    'labour_by_task', COALESCE((SELECT jsonb_agg(to_jsonb(btask) ORDER BY (task = 'Unallocated'), code) FROM btask), '[]'),
    'subcontract', COALESCE((SELECT jsonb_agg(to_jsonb(sub) ORDER BY contractor, boq_code, item) FROM sub), '[]'),
    'totals', jsonb_build_object(
      'value_earned', COALESCE((SELECT sum(value) FROM work), 0),
      'own_labour_cost', COALESCE((SELECT sum(amount) FROM att), 0),
      'subcontract_accrued', COALESCE((SELECT sum(amount) FROM sub), 0))
  ) INTO v;
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.get_running_bill(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_running_bill(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_running_bill(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.parity2_rollback() FROM PUBLIC, anon, authenticated;