-- 1. Add reminder config to finance_statutory
ALTER TABLE public.finance_statutory
ADD COLUMN reminder_days integer DEFAULT 7,
ADD COLUMN recipient_roles text[] DEFAULT '{"finance_manager"}';

-- 2. Create payment_approvals table
CREATE TABLE public.payment_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'general',
  approver_id uuid NULL,
  approver_name text NULL,
  status text NOT NULL DEFAULT 'pending',
  escalation_sent boolean DEFAULT false,
  escalation_sent_at timestamptz NULL,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  approved_at timestamptz NULL,
  approved_by uuid NULL,
  notes text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payment approvals"
ON public.payment_approvals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert payment approvals"
ON public.payment_approvals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update payment approvals"
ON public.payment_approvals FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_payment_approvals_updated_at
BEFORE UPDATE ON public.payment_approvals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create advance_requests table
CREATE TABLE public.advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  employee_name text NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name text NULL,
  amount numeric NOT NULL DEFAULT 0,
  purpose text NULL,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  settled_at timestamptz NULL,
  settlement_method text NULL,
  settled_amount numeric DEFAULT 0,
  carried_forward_amount numeric DEFAULT 0,
  carried_forward_date date NULL,
  next_trip_expected_date date NULL,
  carry_forward_reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view advance requests"
ON public.advance_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert advance requests"
ON public.advance_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update advance requests"
ON public.advance_requests FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_advance_requests_updated_at
BEFORE UPDATE ON public.advance_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();