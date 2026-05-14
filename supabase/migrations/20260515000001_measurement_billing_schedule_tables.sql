-- =====================================================================
-- MEASUREMENT SHEET + BILLING MILESTONES + PROJECT TASKS MIGRATION
-- Adds the 4 core tables missing from the schema audit
-- =====================================================================

-- ── Projects: add missing columns ───────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS contract_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gfc_budget numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tender_margin_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gfc_margin_pct numeric DEFAULT 0;

-- ── Billing Milestones ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_name  text NOT NULL,
  milestone_order int NOT NULL DEFAULT 0,
  percentage      numeric DEFAULT 0,
  amount          numeric DEFAULT 0,
  gst_amount      numeric DEFAULT 0,
  total_with_gst  numeric DEFAULT 0,
  due_date        date,
  invoice_number  text,
  status          text NOT NULL DEFAULT 'pending',
    -- pending | invoiced | paid | overdue
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.billing_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access billing_milestones"
  ON public.billing_milestones FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_billing_milestones_project ON public.billing_milestones(project_id);

-- ── Project Tasks (Schedule) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_number     text,
  task_id          text,
  task_name        text NOT NULL,
  task_type        text,  -- [QC] | [SIGN-OFF] | [PAYMENT] | regular
  duration_days    int DEFAULT 0,
  predecessors     text,  -- comma-separated task_ids
  planned_start    date,
  planned_finish   date,
  actual_start     date,
  actual_finish    date,
  progress_pct     int DEFAULT 0,
  responsible_role text,
  status           text DEFAULT 'not_started',
    -- not_started | in_progress | completed | blocked
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access project_tasks"
  ON public.project_tasks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks(project_id);

-- ── Daily Measurements ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_measurements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  module_id       uuid,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  production_stage text,
  entered_by      uuid REFERENCES auth.users(id),
  entered_by_name text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.daily_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access daily_measurements"
  ON public.daily_measurements FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_daily_measurements_project ON public.daily_measurements(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_measurements_date ON public.daily_measurements(measurement_date);

-- ── Measurement Line Items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.measurement_line_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_measurement_id  uuid NOT NULL REFERENCES public.daily_measurements(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  boq_item_id           uuid,  -- references material_plan_items
  item_description      text NOT NULL,
  unit                  text,
  boq_qty               numeric DEFAULT 0,
  cumulative_qty_prev   numeric DEFAULT 0,  -- auto-calculated on insert
  today_qty             numeric DEFAULT 0,
  cumulative_qty        numeric DEFAULT 0,  -- cumulative_qty_prev + today_qty
  boq_rate              numeric DEFAULT 0,
  value_earned          numeric DEFAULT 0,  -- today_qty × boq_rate
  cumulative_value      numeric DEFAULT 0,  -- cumulative_qty × boq_rate
  notes                 text,
  created_at            timestamptz DEFAULT now()
);
ALTER TABLE public.measurement_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access measurement_line_items"
  ON public.measurement_line_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_measurement_line_items_project ON public.measurement_line_items(project_id);
CREATE INDEX IF NOT EXISTS idx_measurement_line_items_dm ON public.measurement_line_items(daily_measurement_id);
CREATE INDEX IF NOT EXISTS idx_measurement_line_items_boq ON public.measurement_line_items(boq_item_id);

-- ── BOQ Items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.boq_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category        text,
  item_description text NOT NULL,
  unit            text,
  tender_qty      numeric DEFAULT 0,
  actual_qty      numeric DEFAULT 0,
  wastage_pct     numeric DEFAULT 0,
  boq_qty         numeric DEFAULT 0,
  material_rate   numeric DEFAULT 0,
  labour_rate     numeric DEFAULT 0,
  oh_rate         numeric DEFAULT 0,
  boq_rate        numeric DEFAULT 0,
  total_amount    numeric DEFAULT 0,
  margin_pct      numeric DEFAULT 0,
  scope           text,  -- Factory / On-Site Civil / Both
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.boq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access boq_items"
  ON public.boq_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_boq_items_project ON public.boq_items(project_id);

-- ── Work Orders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  wo_number       text NOT NULL,
  title           text NOT NULL,
  description     text,
  scope_of_work   text,
  subcontractor   text,
  amount          numeric DEFAULT 0,
  status          text DEFAULT 'draft',
    -- draft | pending_approval | approved | in_progress | completed | cancelled
  requires_director_approval boolean DEFAULT false,
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  rejection_reason text,
  start_date      date,
  end_date        date,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access work_orders"
  ON public.work_orders FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_work_orders_project ON public.work_orders(project_id);

-- ── Design Sign-offs (for GFC Budget lock check) ─────────────────────
CREATE TABLE IF NOT EXISTS public.design_sign_offs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sign_off_type   text NOT NULL,  -- H1 | H2 | GFC
  status          text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  signed_by       uuid REFERENCES auth.users(id),
  signed_at       timestamptz,
  notes           text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.design_sign_offs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access design_sign_offs"
  ON public.design_sign_offs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_design_sign_offs_project ON public.design_sign_offs(project_id);
