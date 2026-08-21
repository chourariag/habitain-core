
-- 1. PIPELINE (pre-won)
CREATE TABLE public.sales_pipeline_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  contact text,
  segment text NOT NULL CHECK (segment IN ('Home','Office','Hospitality','Retail')),
  location text,
  size_sqft numeric,
  module_count integer,
  value numeric NOT NULL DEFAULT 0,
  sales_rep uuid REFERENCES public.profiles(id),
  sales_rep_name text,
  source text CHECK (source IN ('Lead Gen','Repeat','Referral',E'Add\'l SOW')),
  stage text NOT NULL DEFAULT 'Outbound' CHECK (stage IN ('Outbound','Qualified','Meeting','Proposal Sent','Won','Paused','Lost')),
  temperature text CHECK (temperature IN ('Hot','Warm')),
  status_reason text,
  project_id uuid REFERENCES public.projects(id),
  created_date date NOT NULL DEFAULT CURRENT_DATE,
  last_activity_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_pipeline_leads TO authenticated;
GRANT ALL ON public.sales_pipeline_leads TO service_role;
ALTER TABLE public.sales_pipeline_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership and sales view pipeline leads" ON public.sales_pipeline_leads
  FOR SELECT TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','director',
      'sales_director','finance_director','architecture_director','head_operations','finance_manager',
      'sales_executive','sales_associate','marketing')
  );
CREATE POLICY "Sales and leadership manage pipeline leads" ON public.sales_pipeline_leads
  FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','director',
      'sales_director','sales_executive','sales_associate','marketing')
  );
CREATE POLICY "Sales and leadership update pipeline leads" ON public.sales_pipeline_leads
  FOR UPDATE TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','director',
      'sales_director','sales_executive','sales_associate','marketing')
  ) WITH CHECK (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','director',
      'sales_director','sales_executive','sales_associate','marketing')
  );

CREATE TRIGGER trg_pipeline_leads_updated_at BEFORE UPDATE ON public.sales_pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_pipeline_lead()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stage = 'Won' AND NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'A won deal must be linked to an existing project — create the project first';
  END IF;
  IF NEW.stage IN ('Paused','Lost') AND coalesce(btrim(NEW.status_reason),'') = '' THEN
    RAISE EXCEPTION 'A reason is mandatory when a deal is Paused or Lost';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_pipeline_lead BEFORE INSERT OR UPDATE ON public.sales_pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_lead();

-- 2. MARKETING FUNNEL (monthly)
CREATE TABLE public.marketing_funnel_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  total_leads integer NOT NULL DEFAULT 0,
  qualified_leads integer NOT NULL DEFAULT 0,
  model_home_visits integer NOT NULL DEFAULT 0,
  proposals_shared integer NOT NULL DEFAULT 0,
  meta_ad_spend numeric NOT NULL DEFAULT 0,
  webinar_spend numeric NOT NULL DEFAULT 0,
  leads_instagram integer NOT NULL DEFAULT 0,
  leads_youtube integer NOT NULL DEFAULT 0,
  leads_website integer NOT NULL DEFAULT 0,
  leads_webinar integer NOT NULL DEFAULT 0,
  leads_direct integer NOT NULL DEFAULT 0,
  instagram_followers integer,
  instagram_views integer,
  instagram_reach integer,
  youtube_subscribers integer,
  youtube_views integer,
  webinar_attendees integer,
  cost_per_qualified_lead numeric GENERATED ALWAYS AS (
    CASE WHEN qualified_leads > 0 THEN round((meta_ad_spend + webinar_spend) / qualified_leads, 2) END
  ) STORED,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_funnel_monthly TO authenticated;
GRANT ALL ON public.marketing_funnel_monthly TO service_role;
ALTER TABLE public.marketing_funnel_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership views marketing funnel" ON public.marketing_funnel_monthly
  FOR SELECT TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','director',
      'sales_director','finance_director','architecture_director','head_operations','finance_manager',
      'sales_executive','sales_associate','marketing'));
CREATE POLICY "Marketing manages marketing funnel" ON public.marketing_funnel_monthly
  FOR ALL TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','sales_director','marketing'))
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','sales_director','marketing'));
CREATE TRIGGER trg_marketing_funnel_updated_at BEFORE UPDATE ON public.marketing_funnel_monthly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. CALL / CONVERSION FUNNEL (monthly)
CREATE TABLE public.call_funnel_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  leads_total integer NOT NULL DEFAULT 0,
  calls_made integer NOT NULL DEFAULT 0,
  calls_answered integer NOT NULL DEFAULT 0,
  calls_rnr integer NOT NULL DEFAULT 0,
  calls_qualified integer NOT NULL DEFAULT 0,
  visits_from_qualified integer NOT NULL DEFAULT 0,
  loss_reason text CHECK (loss_reason IN ('Budget','Timeline','Location Out of Range','Competitor','Not Responsive','Scope Mismatch','Deferred','Other')),
  loss_reason_detail text,
  data_quality_flag boolean GENERATED ALWAYS AS (
    calls_made > 0 AND calls_answered = calls_made AND calls_rnr = 0
  ) STORED,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_funnel_monthly TO authenticated;
GRANT ALL ON public.call_funnel_monthly TO service_role;
ALTER TABLE public.call_funnel_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership views call funnel" ON public.call_funnel_monthly
  FOR SELECT TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','director',
      'sales_director','finance_director','architecture_director','head_operations','finance_manager',
      'sales_executive','sales_associate','marketing'));
CREATE POLICY "Sales manages call funnel" ON public.call_funnel_monthly
  FOR ALL TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','sales_director','marketing'))
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','sales_director','marketing'));
CREATE TRIGGER trg_call_funnel_updated_at BEFORE UPDATE ON public.call_funnel_monthly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. BUDGET vs FORECAST period plan (keyed like finance_pl_data: month + year)
CREATE TABLE public.board_period_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  scenario text NOT NULL CHECK (scenario IN ('budget','forecast')),
  revenue numeric NOT NULL DEFAULT 0,
  salaries numeric NOT NULL DEFAULT 0,
  director_remuneration numeric NOT NULL DEFAULT 0,
  rent_electricity numeric NOT NULL DEFAULT 0,
  other_fixed_expenses numeric NOT NULL DEFAULT 0,
  contribution_pct numeric,
  ebitda numeric,
  sm_payroll numeric NOT NULL DEFAULT 0,
  orders_closed integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month, scenario)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_period_plan TO authenticated;
GRANT ALL ON public.board_period_plan TO service_role;
ALTER TABLE public.board_period_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership views period plan" ON public.board_period_plan
  FOR SELECT TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','director',
      'sales_director','finance_director','architecture_director','head_operations','finance_manager'));
CREATE POLICY "Finance manages period plan" ON public.board_period_plan
  FOR ALL TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','finance_director','finance_manager'))
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','finance_director','finance_manager'));
CREATE TRIGGER trg_board_period_plan_updated_at BEFORE UPDATE ON public.board_period_plan
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Reported (stated) headline totals for reconciliation
CREATE TABLE public.board_reported_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  dimension text NOT NULL,
  as_of_date date NOT NULL DEFAULT CURRENT_DATE,
  stated_total numeric NOT NULL,
  scope_filter text,
  source_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_reported_totals TO authenticated;
GRANT ALL ON public.board_reported_totals TO service_role;
ALTER TABLE public.board_reported_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership views reported totals" ON public.board_reported_totals
  FOR SELECT TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','director',
      'sales_director','finance_director','architecture_director','head_operations','finance_manager','marketing'));
CREATE POLICY "Leadership manages reported totals" ON public.board_reported_totals
  FOR ALL TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','sales_director','finance_director'))
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('super_admin','managing_director','chairman','sales_director','finance_director'));
CREATE TRIGGER trg_board_reported_totals_updated_at BEFORE UPDATE ON public.board_reported_totals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Derived views
CREATE OR REPLACE VIEW public.v_sales_segment_reconciliation
WITH (security_invoker = true) AS
SELECT t.id AS total_id, t.label, t.dimension, t.stated_total, t.as_of_date,
       coalesce(s.computed_total, 0) AS computed_total,
       t.stated_total - coalesce(s.computed_total, 0) AS gap
FROM public.board_reported_totals t
LEFT JOIN LATERAL (
  SELECT sum(l.value) AS computed_total
  FROM public.sales_pipeline_leads l
  WHERE l.is_archived = false
    AND (t.scope_filter IS NULL OR l.stage = ANY (string_to_array(t.scope_filter, ',')))
    AND (t.dimension <> 'segment' OR l.segment IN ('Home','Office','Hospitality','Retail'))
) s ON true;

CREATE OR REPLACE VIEW public.v_unit_economics_monthly
WITH (security_invoker = true) AS
SELECT p.year, p.month, p.scenario,
       (p.sm_payroll + coalesce(m.meta_ad_spend,0) + coalesce(m.webinar_spend,0)) AS sm_plus_media,
       p.orders_closed,
       CASE WHEN p.orders_closed > 0
            THEN round((p.sm_payroll + coalesce(m.meta_ad_spend,0) + coalesce(m.webinar_spend,0)) / p.orders_closed, 2)
       END AS cac,
       p.contribution_pct,
       CASE WHEN p.orders_closed > 0 AND (p.sm_payroll + coalesce(m.meta_ad_spend,0) + coalesce(m.webinar_spend,0)) > 0
            THEN round((p.revenue * coalesce(p.contribution_pct,0) / 100.0)
                 / (p.sm_payroll + coalesce(m.meta_ad_spend,0) + coalesce(m.webinar_spend,0)), 2)
       END AS contribution_per_rupee_cac
FROM public.board_period_plan p
LEFT JOIN public.marketing_funnel_monthly m
  ON m.month = make_date(p.year, p.month, 1);

GRANT SELECT ON public.v_sales_segment_reconciliation TO authenticated;
GRANT SELECT ON public.v_unit_economics_monthly TO authenticated;
