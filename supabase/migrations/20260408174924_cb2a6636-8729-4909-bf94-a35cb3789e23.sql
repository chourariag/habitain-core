
-- Add missing columns to advance_requests
ALTER TABLE public.advance_requests
  ADD COLUMN IF NOT EXISTS advance_id text,
  ADD COLUMN IF NOT EXISTS dispatch_date date,
  ADD COLUMN IF NOT EXISTS days_on_site integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS staff_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS within_policy_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS above_policy_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_emergency boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hod_approved_by uuid,
  ADD COLUMN IF NOT EXISTS hod_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS md_approved_by uuid,
  ADD COLUMN IF NOT EXISTS md_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_reference text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'bank_transfer';

-- Drop overly permissive RLS policies
DROP POLICY IF EXISTS "Authenticated users can insert advance requests" ON public.advance_requests;
DROP POLICY IF EXISTS "Authenticated users can update advance requests" ON public.advance_requests;
DROP POLICY IF EXISTS "Authenticated users can view advance requests" ON public.advance_requests;

-- Full admin access
CREATE POLICY "Full admin access on advance requests"
  ON public.advance_requests FOR ALL
  TO authenticated
  USING (public.is_full_admin(auth.uid()))
  WITH CHECK (public.is_full_admin(auth.uid()));

-- Site installation manager can insert own requests
CREATE POLICY "SIM can insert own advance requests"
  ON public.advance_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'site_installation_mgr')
    AND employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- SIM can view own requests
CREATE POLICY "SIM can view own advance requests"
  ON public.advance_requests FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'site_installation_mgr')
    AND employee_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- Production head (HOD) can view and update all
CREATE POLICY "Production head can manage advance requests"
  ON public.advance_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'production_head'))
  WITH CHECK (public.has_role(auth.uid(), 'production_head'));

-- Head of operations can manage
CREATE POLICY "Head ops can manage advance requests"
  ON public.advance_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'head_operations'))
  WITH CHECK (public.has_role(auth.uid(), 'head_operations'));

-- Finance manager can view all and update (release payments)
CREATE POLICY "Finance manager can manage advance requests"
  ON public.advance_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'finance_manager'));

-- Directors can view all
CREATE POLICY "Directors can view advance requests"
  ON public.advance_requests FOR SELECT
  TO authenticated
  USING (public.is_director(auth.uid()));
