
-- Payslips
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  pdf_url TEXT,
  uploaded_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, year)
);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_hr_documents(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive','hr_executive')
  )
$$;

CREATE POLICY "Employees view own payslips" ON public.payslips
  FOR SELECT USING (user_id = auth.uid() OR public.can_manage_hr_documents(auth.uid()));
CREATE POLICY "HR manages payslips" ON public.payslips
  FOR ALL USING (public.can_manage_hr_documents(auth.uid()))
  WITH CHECK (public.can_manage_hr_documents(auth.uid()));

CREATE TRIGGER update_payslips_updated_at BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- HR documents
CREATE TABLE public.hr_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  issued_on DATE,
  uploaded_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view own docs" ON public.hr_documents
  FOR SELECT USING (user_id = auth.uid() OR public.can_manage_hr_documents(auth.uid()));
CREATE POLICY "HR manages docs" ON public.hr_documents
  FOR ALL USING (public.can_manage_hr_documents(auth.uid()))
  WITH CHECK (public.can_manage_hr_documents(auth.uid()));

-- Leave balances
CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  year INT NOT NULL,
  cl_total INT NOT NULL DEFAULT 12,
  sl_total INT NOT NULL DEFAULT 6,
  el_total INT NOT NULL DEFAULT 15,
  cl_used INT NOT NULL DEFAULT 0,
  sl_used INT NOT NULL DEFAULT 0,
  el_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view own balance" ON public.leave_balances
  FOR SELECT USING (user_id = auth.uid() OR public.can_manage_hr_documents(auth.uid()));
CREATE POLICY "HR manages balances" ON public.leave_balances
  FOR ALL USING (public.can_manage_hr_documents(auth.uid()))
  WITH CHECK (public.can_manage_hr_documents(auth.uid()));
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for payslips/docs (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-docs', 'hr-docs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "HR uploads to hr-docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hr-docs' AND public.can_manage_hr_documents(auth.uid()));
CREATE POLICY "HR updates hr-docs" ON storage.objects FOR UPDATE
  USING (bucket_id = 'hr-docs' AND public.can_manage_hr_documents(auth.uid()));
CREATE POLICY "HR deletes hr-docs" ON storage.objects FOR DELETE
  USING (bucket_id = 'hr-docs' AND public.can_manage_hr_documents(auth.uid()));
CREATE POLICY "Employees read own hr-docs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hr-docs'
    AND (
      public.can_manage_hr_documents(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
