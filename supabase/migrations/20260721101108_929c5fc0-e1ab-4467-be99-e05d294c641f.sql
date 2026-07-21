
-- Helper: role check
CREATE OR REPLACE FUNCTION public.is_tally_ingest_viewer(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin','managing_director','finance_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tally_ingest_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin','managing_director')
  )
$$;

-- =========================================================
-- API KEY VAULT
-- =========================================================
CREATE TABLE public.tally_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  notes text
);
CREATE INDEX idx_tally_api_keys_active ON public.tally_api_keys(revoked_at) WHERE revoked_at IS NULL;

GRANT SELECT ON public.tally_api_keys TO authenticated;
GRANT ALL ON public.tally_api_keys TO service_role;
ALTER TABLE public.tally_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers can read key metadata" ON public.tally_api_keys
  FOR SELECT TO authenticated USING (public.is_tally_ingest_viewer(auth.uid()));

-- =========================================================
-- INGEST LOG
-- =========================================================
CREATE TABLE public.tally_ingest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type text NOT NULL,
  company_name text,
  batch_id text NOT NULL,
  sync_timestamp timestamptz,
  record_count integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success','failed','duplicate')),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  source_ip text
);
CREATE INDEX idx_tally_ingest_log_batch ON public.tally_ingest_log(data_type, batch_id);
CREATE INDEX idx_tally_ingest_log_received ON public.tally_ingest_log(received_at DESC);

GRANT SELECT ON public.tally_ingest_log TO authenticated;
GRANT ALL ON public.tally_ingest_log TO service_role;
ALTER TABLE public.tally_ingest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers read ingest log" ON public.tally_ingest_log
  FOR SELECT TO authenticated USING (public.is_tally_ingest_viewer(auth.uid()));

-- =========================================================
-- DATA TABLES
-- =========================================================
-- Common columns macro (repeat inline for clarity)
CREATE TABLE public.tally_trial_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  ledger_name text, group_name text,
  opening_balance numeric, debit numeric, credit numeric, closing_balance numeric,
  as_of_date date
);

CREATE TABLE public.tally_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  po_number text, po_date date, vendor_name text, item_name text,
  quantity numeric, rate numeric, amount numeric, due_date date, status text
);

CREATE TABLE public.tally_purchase_order_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  po_number text, po_date date, vendor_name text,
  total_amount numeric, status text, last_updated timestamptz
);

CREATE TABLE public.tally_grn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  grn_number text, grn_date date, po_number text, vendor_name text,
  item_name text, quantity_received numeric, quantity_ordered numeric, remarks text
);

CREATE TABLE public.tally_sales_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  invoice_number text, invoice_date date, customer_name text, item_name text,
  quantity numeric, rate numeric, amount numeric, total_amount numeric, status text
);

CREATE TABLE public.tally_purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  bill_number text, bill_date date, vendor_name text, po_number text,
  amount numeric, outstanding_amount numeric, due_date date
);

CREATE TABLE public.tally_vendor_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  vendor_name text, ledger_group text,
  opening_balance numeric, total_billed numeric, total_paid numeric,
  outstanding_balance numeric, ageing_bucket text
);

CREATE TABLE public.tally_customer_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  customer_name text, ledger_group text,
  opening_balance numeric, total_invoiced numeric, total_received numeric,
  outstanding_balance numeric, ageing_bucket text
);

CREATE TABLE public.tally_bank_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  bank_ledger_name text, transaction_date date, voucher_type text, narration text,
  debit numeric, credit numeric, running_balance numeric
);

CREATE TABLE public.tally_cash_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  transaction_date date, voucher_type text, narration text,
  debit numeric, credit numeric, running_balance numeric
);

CREATE TABLE public.tally_cost_centre_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, batch_id text NOT NULL, sync_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  cost_centre_name text, ledger_name text, voucher_type text,
  amount numeric, transaction_date date, period text
);

-- Grants + RLS: viewers read, service_role writes
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tally_trial_balance','tally_purchase_orders','tally_purchase_order_register',
    'tally_grn','tally_sales_vouchers','tally_purchase_invoices',
    'tally_vendor_ledgers','tally_customer_ledgers','tally_bank_book',
    'tally_cash_book','tally_cost_centre_data'
  ]) LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "Viewers read %I" ON public.%I FOR SELECT TO authenticated USING (public.is_tally_ingest_viewer(auth.uid()));', t, t);
    EXECUTE format('CREATE INDEX %I ON public.%I(batch_id);', 'idx_'||t||'_batch', t);
  END LOOP;
END $$;
