TRUNCATE TABLE 
  public.project_messages,
  public.project_tasks,
  public.boq_items,
  public.material_plan_items,
  public.project_billing_milestones,
  public.project_variations,
  public.daily_measurements,
  public.measurement_line_items,
  public.project_grns,
  public.purchase_orders,
  public.work_orders,
  public.expense_entries,
  public.expense_reports,
  public.advance_requests,
  public.projects
RESTART IDENTITY CASCADE;