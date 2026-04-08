
-- project_invoices
CREATE TABLE public.project_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_type text NOT NULL CHECK (invoice_type IN ('part','final')),
  dispatch_event_id uuid,
  raised_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  amount_total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  amount_outstanding numeric GENERATED ALWAYS AS (amount_total - amount_paid) STORED,
  status text NOT NULL DEFAULT 'draft',
  sent_date date,
  sent_to_email text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles full access on project_invoices"
  ON public.project_invoices FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager')
    )
  );

CREATE POLICY "Planning engineer read own project invoices"
  ON public.project_invoices FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role = 'planning_engineer'
    )
    AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()
    )
  );

-- invoice_variations
CREATE TABLE public.invoice_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.project_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  client_approval_ref text,
  value numeric NOT NULL DEFAULT 0,
  contribution_margin_pct numeric,
  approved_date date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles full access on invoice_variations"
  ON public.invoice_variations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager')
    )
  );

CREATE POLICY "Planning engineer read own project variations"
  ON public.invoice_variations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role = 'planning_engineer'
    )
    AND invoice_id IN (
      SELECT pi.id FROM public.project_invoices pi
      JOIN public.projects p ON p.id = pi.project_id
      WHERE p.created_by = auth.uid()
    )
  );

-- invoice_payments
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.project_invoices(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_received numeric NOT NULL DEFAULT 0,
  payment_reference text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles full access on invoice_payments"
  ON public.invoice_payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager')
    )
  );

CREATE POLICY "Planning engineer read own project payments"
  ON public.invoice_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role = 'planning_engineer'
    )
    AND invoice_id IN (
      SELECT pi.id FROM public.project_invoices pi
      JOIN public.projects p ON p.id = pi.project_id
      WHERE p.created_by = auth.uid()
    )
  );

-- Trigger for updated_at on project_invoices
CREATE TRIGGER update_project_invoices_updated_at
  BEFORE UPDATE ON public.project_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
