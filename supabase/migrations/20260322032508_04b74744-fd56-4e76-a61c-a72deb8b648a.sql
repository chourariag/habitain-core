
CREATE TABLE public.expense_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  description text NOT NULL,
  receipt_url text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending_costing',
  stage1_approved_by uuid,
  stage1_approved_at timestamptz,
  stage1_note text,
  stage2_approved_by uuid,
  stage2_approved_at timestamptz,
  rejection_reason text,
  budget_flag boolean DEFAULT false,
  budget_overrun_amount numeric,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;

-- Everyone can see own expenses
CREATE POLICY "Users can view own expenses" ON public.expense_reports
  FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director', 'hr_executive', 'finance_manager', 'costing_engineer', 'production_head', 'head_operations')
  );

-- Any non-architect authenticated user can submit
CREATE POLICY "Users can insert own expenses" ON public.expense_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND get_user_role(auth.uid()) NOT IN ('principal_architect', 'project_architect', 'structural_architect')
  );

-- Approval roles can update
CREATE POLICY "Approval roles can update expenses" ON public.expense_reports
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director', 'costing_engineer', 'production_head', 'head_operations', 'finance_manager', 'accounts_executive')
  );
