-- QA pass: create missing tables and compatibility views
-- for tables referenced in spec but absent or renamed in earlier migrations.

-- ─────────────────────────────────────────────
-- 1. stage_history  (production stage audit log)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stage_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  stage_name    text NOT NULL,
  from_stage    text,
  to_stage      text NOT NULL,
  changed_by    uuid REFERENCES auth.users(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read stage_history" ON public.stage_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert stage_history" ON public.stage_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 2. supervisor_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supervisor_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid REFERENCES auth.users(id),
  log_type      text NOT NULL,
  module_id     uuid,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supervisor_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors can read own logs" ON public.supervisor_logs
  FOR SELECT TO authenticated USING (supervisor_id = auth.uid() OR is_director(auth.uid()));

CREATE POLICY "Supervisors can insert logs" ON public.supervisor_logs
  FOR INSERT TO authenticated WITH CHECK (supervisor_id = auth.uid());

-- ─────────────────────────────────────────────
-- 3. goods_received  (GRN)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goods_received (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id    uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  received_by          uuid REFERENCES auth.users(id),
  received_date        date NOT NULL DEFAULT CURRENT_DATE,
  items                jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goods_received ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read goods_received" ON public.goods_received
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Stores can insert goods_received" ON public.goods_received
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 4. design_projects
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.design_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  lead_architect  uuid REFERENCES auth.users(id),
  start_date      date,
  target_date     date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.design_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read design_projects" ON public.design_projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Architects can manage design_projects" ON public.design_projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 5. Compatibility views for renamed tables
-- ─────────────────────────────────────────────

-- ncr_tickets  → ncr_register
CREATE OR REPLACE VIEW public.ncr_tickets AS
  SELECT * FROM public.ncr_register;

-- dispatch_pipeline  → dispatch_log
CREATE OR REPLACE VIEW public.dispatch_pipeline AS
  SELECT * FROM public.dispatch_log;

-- handover_records  → handover_pack
CREATE OR REPLACE VIEW public.handover_records AS
  SELECT * FROM public.handover_pack;

-- finance_pl  → finance_pl_data
CREATE OR REPLACE VIEW public.finance_pl AS
  SELECT * FROM public.finance_pl_data;

-- finance_budgets  → finance_project_budgets
CREATE OR REPLACE VIEW public.finance_budgets AS
  SELECT * FROM public.finance_project_budgets;
