-- 1. Client Work Orders (inbound, client-issued to ALTREE). Distinct from public.work_orders (outbound to subcontractors).
CREATE TABLE public.client_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number text NOT NULL,
  amendment_number text,
  client_company_name text NOT NULL,
  client_contact_name text,
  client_contact_email text,
  client_contact_phone text,
  issue_date date,
  amendment_date date,
  commencement_date date,
  completion_days integer,
  retention_pct numeric NOT NULL DEFAULT 0,
  dlp_months integer NOT NULL DEFAULT 0,
  delay_damages_pct_per_week numeric NOT NULL DEFAULT 0,
  delay_damages_cap_pct numeric NOT NULL DEFAULT 0,
  material_advance_pct_1 numeric NOT NULL DEFAULT 0,
  material_advance_pct_2 numeric NOT NULL DEFAULT 0,
  advance_recovery_threshold_pct numeric NOT NULL DEFAULT 80,
  advance_disbursed numeric NOT NULL DEFAULT 0,
  advance_recovered_to_date numeric NOT NULL DEFAULT 0,
  gst_pct numeric NOT NULL DEFAULT 18,
  sub_total numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  -- Acceptance Statement (externally signed combined document pattern)
  acceptance_platform text,
  acceptance_document_id text,
  acceptance_date date,
  our_signatory text,
  our_signatory_id uuid,
  witness_name text,
  acceptance_pdf_url text,
  acceptance_signed boolean NOT NULL DEFAULT false,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_work_orders_wo_number_key UNIQUE (wo_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_work_orders TO authenticated;
GRANT ALL ON public.client_work_orders TO service_role;
ALTER TABLE public.client_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view client work orders"
  ON public.client_work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and directors manage client work orders"
  ON public.client_work_orders FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'managing_director')
    OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'finance_director')
    OR public.has_role(auth.uid(), 'sales_director') OR public.has_role(auth.uid(), 'finance_manager')
    OR public.has_role(auth.uid(), 'planning_head') OR public.has_role(auth.uid(), 'head_of_projects')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'managing_director')
    OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'finance_director')
    OR public.has_role(auth.uid(), 'sales_director') OR public.has_role(auth.uid(), 'finance_manager')
    OR public.has_role(auth.uid(), 'planning_head') OR public.has_role(auth.uid(), 'head_of_projects')
  );

CREATE TRIGGER trg_cwo_updated_at BEFORE UPDATE ON public.client_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Link projects to a client work order (many projects -> one WO)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_work_order_id uuid REFERENCES public.client_work_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wo_line_item_ref text;
CREATE INDEX IF NOT EXISTS idx_projects_client_wo ON public.projects(client_work_order_id);

-- 3. Per-WO flexible payment schedule
CREATE TABLE public.client_wo_payment_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.client_work_orders(id) ON DELETE CASCADE,
  stage_order integer NOT NULL,
  stage_name text NOT NULL,
  percentage numeric NOT NULL DEFAULT 0,
  trigger_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, stage_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_wo_payment_stages TO authenticated;
GRANT ALL ON public.client_wo_payment_stages TO service_role;
ALTER TABLE public.client_wo_payment_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view wo payment stages"
  ON public.client_wo_payment_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and directors manage wo payment stages"
  ON public.client_wo_payment_stages FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'managing_director')
    OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'finance_director')
    OR public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'planning_head')
    OR public.has_role(auth.uid(), 'head_of_projects')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'managing_director')
    OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'finance_director')
    OR public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'planning_head')
    OR public.has_role(auth.uid(), 'head_of_projects')
  );
CREATE TRIGGER trg_cwo_stage_updated_at BEFORE UPDATE ON public.client_wo_payment_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Retention ledger (one row per bill raised on a linked project)
CREATE TABLE public.client_wo_retention_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.client_work_orders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id uuid,
  bill_reference text,
  bill_amount numeric NOT NULL DEFAULT 0,
  retention_pct numeric NOT NULL DEFAULT 0,
  retention_amount numeric NOT NULL DEFAULT 0,
  advance_recovery_flagged numeric NOT NULL DEFAULT 0,
  released boolean NOT NULL DEFAULT false,
  released_at timestamptz,
  released_by uuid,
  release_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_wo_retention_entries TO authenticated;
GRANT ALL ON public.client_wo_retention_entries TO service_role;
ALTER TABLE public.client_wo_retention_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view retention entries"
  ON public.client_wo_retention_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance manages retention entries"
  ON public.client_wo_retention_entries FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'managing_director')
    OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'finance_director')
    OR public.has_role(auth.uid(), 'finance_manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'managing_director')
    OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'finance_director')
    OR public.has_role(auth.uid(), 'finance_manager')
  );
CREATE TRIGGER trg_cwo_ret_updated_at BEFORE UPDATE ON public.client_wo_retention_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Defect Liability Period clock per linked project
CREATE TABLE public.client_wo_dlp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.client_work_orders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dlp_start_date date NOT NULL,
  dlp_months integer NOT NULL DEFAULT 0,
  dlp_end_date date,
  flagged_for_review boolean NOT NULL DEFAULT false,
  flagged_at timestamptz,
  finance_decision text,
  decided_by uuid,
  decided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_wo_dlp TO authenticated;
GRANT ALL ON public.client_wo_dlp TO service_role;
ALTER TABLE public.client_wo_dlp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view dlp"
  ON public.client_wo_dlp FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance manages dlp"
  ON public.client_wo_dlp FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'managing_director')
    OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'finance_director')
    OR public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'head_of_projects')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'managing_director')
    OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'finance_director')
    OR public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'head_of_projects')
  );
CREATE TRIGGER trg_cwo_dlp_updated_at BEFORE UPDATE ON public.client_wo_dlp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.cwo_set_dlp_end()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.dlp_end_date := NEW.dlp_start_date + (COALESCE(NEW.dlp_months,0) || ' months')::interval;
  IF NEW.dlp_end_date <= CURRENT_DATE AND NOT NEW.flagged_for_review AND NEW.finance_decision IS NULL THEN
    NEW.flagged_for_review := true;
    NEW.flagged_at := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cwo_dlp_end BEFORE INSERT OR UPDATE ON public.client_wo_dlp
  FOR EACH ROW EXECUTE FUNCTION public.cwo_set_dlp_end();

-- 6. Payment stage percentages must total 100 per WO
CREATE OR REPLACE FUNCTION public.cwo_validate_stage_pct()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_wo uuid; v_sum numeric;
BEGIN
  v_wo := COALESCE(NEW.work_order_id, OLD.work_order_id);
  SELECT COALESCE(SUM(percentage),0) INTO v_sum FROM public.client_wo_payment_stages WHERE work_order_id = v_wo;
  IF v_sum > 100.01 THEN
    RAISE EXCEPTION 'Payment stages for this Work Order total %%%, cannot exceed 100%%', v_sum;
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER trg_cwo_stage_pct AFTER INSERT OR UPDATE OR DELETE ON public.client_wo_payment_stages
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.cwo_validate_stage_pct();

-- 7. WO commercial rollup (billed across all linked projects, retention, advance, delay exposure)
CREATE OR REPLACE FUNCTION public.get_client_wo_summary(_wo_id uuid)
RETURNS TABLE (
  work_order_id uuid,
  grand_total numeric,
  billed_to_date numeric,
  billed_pct numeric,
  retention_held numeric,
  retention_released numeric,
  advance_disbursed numeric,
  advance_recovered numeric,
  advance_outstanding numeric,
  advance_recovery_active boolean,
  linked_projects integer,
  delay_weeks integer,
  delay_exposure numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.client_work_orders%ROWTYPE; v_billed numeric; v_projects integer;
        v_planned date; v_actual date; v_weeks integer; v_exposure numeric; v_cap numeric;
BEGIN
  SELECT * INTO w FROM public.client_work_orders WHERE id = _wo_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(m.amount_incl_gst),0), COUNT(DISTINCT p.id)
    INTO v_billed, v_projects
  FROM public.projects p
  LEFT JOIN public.project_billing_milestones m
    ON m.project_id = p.id AND m.status IN ('billed','invoiced','received','paid')
  WHERE p.client_work_order_id = _wo_id;

  v_planned := w.commencement_date + (COALESCE(w.completion_days,0) || ' days')::interval;
  SELECT MAX(COALESCE(p.actual_completion_date, CURRENT_DATE)) INTO v_actual
    FROM public.projects p WHERE p.client_work_order_id = _wo_id AND p.status <> 'Cancelled';
  v_weeks := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (COALESCE(v_actual, CURRENT_DATE) - v_planned)) / 604800.0)::int);
  IF w.commencement_date IS NULL OR COALESCE(w.completion_days,0) = 0 THEN v_weeks := 0; END IF;
  v_cap := COALESCE(w.delay_damages_cap_pct,0)/100.0 * COALESCE(w.grand_total,0);
  v_exposure := LEAST(v_weeks * COALESCE(w.delay_damages_pct_per_week,0)/100.0 * COALESCE(w.grand_total,0), v_cap);

  RETURN QUERY
  SELECT
    w.id,
    w.grand_total,
    COALESCE(v_billed,0),
    CASE WHEN COALESCE(w.grand_total,0) > 0 THEN ROUND(COALESCE(v_billed,0)/w.grand_total*100, 2) ELSE 0 END,
    (SELECT COALESCE(SUM(r.retention_amount),0) FROM public.client_wo_retention_entries r WHERE r.work_order_id = _wo_id AND NOT r.released),
    (SELECT COALESCE(SUM(r.retention_amount),0) FROM public.client_wo_retention_entries r WHERE r.work_order_id = _wo_id AND r.released),
    w.advance_disbursed,
    w.advance_recovered_to_date,
    GREATEST(COALESCE(w.advance_disbursed,0) - COALESCE(w.advance_recovered_to_date,0), 0),
    (COALESCE(w.grand_total,0) > 0
      AND COALESCE(v_billed,0) < COALESCE(w.advance_recovery_threshold_pct,80)/100.0 * w.grand_total
      AND COALESCE(w.advance_disbursed,0) > COALESCE(w.advance_recovered_to_date,0)),
    COALESCE(v_projects,0),
    v_weeks,
    GREATEST(COALESCE(v_exposure,0),0);
END; $$;

REVOKE ALL ON FUNCTION public.get_client_wo_summary(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_client_wo_summary(uuid) TO authenticated, service_role;

-- 8. Auto-record retention + flag advance recovery when a bill is raised on a contractor_wo project
CREATE OR REPLACE FUNCTION public.cwo_record_retention_on_bill()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.client_work_orders%ROWTYPE; v_wo uuid; v_billed numeric; v_recovery numeric := 0; v_threshold numeric;
BEGIN
  IF NEW.status NOT IN ('billed','invoiced') OR COALESCE(OLD.status,'') = NEW.status THEN RETURN NEW; END IF;
  SELECT client_work_order_id INTO v_wo FROM public.projects WHERE id = NEW.project_id;
  IF v_wo IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.client_wo_retention_entries WHERE milestone_id = NEW.id) THEN RETURN NEW; END IF;

  SELECT * INTO w FROM public.client_work_orders WHERE id = v_wo;
  v_threshold := COALESCE(w.advance_recovery_threshold_pct, 80)/100.0 * COALESCE(w.grand_total,0);
  SELECT COALESCE(SUM(m.amount_incl_gst),0) INTO v_billed
    FROM public.projects p JOIN public.project_billing_milestones m ON m.project_id = p.id
    WHERE p.client_work_order_id = v_wo AND m.status IN ('billed','invoiced','received','paid');

  IF COALESCE(w.advance_disbursed,0) > COALESCE(w.advance_recovered_to_date,0)
     AND v_threshold > 0 AND v_billed <= v_threshold THEN
    v_recovery := LEAST(
      ROUND(COALESCE(NEW.amount_incl_gst,0) / NULLIF(v_threshold,0) * COALESCE(w.advance_disbursed,0), 2),
      COALESCE(w.advance_disbursed,0) - COALESCE(w.advance_recovered_to_date,0));
  END IF;

  INSERT INTO public.client_wo_retention_entries
    (work_order_id, project_id, milestone_id, bill_reference, bill_amount, retention_pct, retention_amount, advance_recovery_flagged)
  VALUES (v_wo, NEW.project_id, NEW.id, COALESCE(NEW.invoice_number, NEW.description),
          COALESCE(NEW.amount_incl_gst,0), COALESCE(w.retention_pct,0),
          ROUND(COALESCE(NEW.amount_incl_gst,0) * COALESCE(w.retention_pct,0)/100.0, 2),
          COALESCE(v_recovery,0));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cwo_retention_on_bill AFTER UPDATE ON public.project_billing_milestones
  FOR EACH ROW EXECUTE FUNCTION public.cwo_record_retention_on_bill();