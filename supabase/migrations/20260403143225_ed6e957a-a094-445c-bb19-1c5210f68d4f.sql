
CREATE TABLE public.bank_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL,
  particulars text NOT NULL,
  vch_type text,
  vch_no text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  balance numeric,
  upload_month text,
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE public.bank_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance read bank ledger" ON public.bank_ledger_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));

CREATE POLICY "Finance insert bank ledger" ON public.bank_ledger_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));

CREATE POLICY "Finance delete bank ledger" ON public.bank_ledger_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));

CREATE TABLE public.creditor_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_name text NOT NULL,
  bill_date date,
  bill_no text,
  due_date date,
  amount numeric NOT NULL,
  overdue_days integer,
  status text,
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE public.creditor_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance read creditor ledger" ON public.creditor_ledger_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));

CREATE POLICY "Finance insert creditor ledger" ON public.creditor_ledger_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));

CREATE POLICY "Finance delete creditor ledger" ON public.creditor_ledger_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));

CREATE TABLE public.debtor_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_name text NOT NULL,
  bill_date date,
  bill_no text,
  due_date date,
  amount numeric NOT NULL,
  overdue_days integer,
  status text,
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE public.debtor_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance read debtor ledger" ON public.debtor_ledger_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));

CREATE POLICY "Finance insert debtor ledger" ON public.debtor_ledger_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));

CREATE POLICY "Finance delete debtor ledger" ON public.debtor_ledger_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager') OR public.is_director(auth.uid()));
