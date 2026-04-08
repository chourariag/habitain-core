
CREATE TABLE public.retention_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  contract_value numeric NOT NULL DEFAULT 0,
  retention_pct numeric NOT NULL DEFAULT 2.5,
  retention_amount numeric NOT NULL DEFAULT 0,
  hold_start_date date NOT NULL,
  expected_release_date date NOT NULL,
  actual_release_date date,
  amount_received numeric,
  payment_reference text,
  status text NOT NULL DEFAULT 'held',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.retention_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles full access on retention_records"
  ON public.retention_records FOR ALL TO authenticated
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

CREATE TRIGGER update_retention_records_updated_at
  BEFORE UPDATE ON public.retention_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
