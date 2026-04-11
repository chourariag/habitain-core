-- Add missing columns to expense_entries
ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS submission_method text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS uploaded_on_behalf_of uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rate_used numeric;

-- Add reason to hr_settings
ALTER TABLE public.hr_settings ADD COLUMN IF NOT EXISTS reason text;

-- Seed expense flag threshold
INSERT INTO public.hr_settings (key, value, status)
VALUES ('expense_flag_threshold', '5000', 'active')
ON CONFLICT (key) DO NOTHING;

-- Fix INSERT policy: allow HR/admin to insert on behalf of employees
DROP POLICY IF EXISTS "Users insert own expense entries" ON public.expense_entries;
CREATE POLICY "Users insert own expense entries" ON public.expense_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN (
      'hr_executive', 'super_admin', 'managing_director'
    )
  );

-- Fix SELECT policy: add accounts_executive for mark-paid flow
DROP POLICY IF EXISTS "Users see own expense entries" ON public.expense_entries;
CREATE POLICY "Users see own expense entries" ON public.expense_entries
  FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN (
      'super_admin', 'managing_director', 'finance_director', 'sales_director',
      'architecture_director', 'hr_executive', 'finance_manager', 'accounts_executive'
    )
    OR (
      status = 'pending_hod'
      AND public.get_user_role(auth.uid()) IN ('production_head', 'head_operations')
    )
  );
