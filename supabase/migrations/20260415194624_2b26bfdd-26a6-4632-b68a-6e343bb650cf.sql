
-- Create billing milestones table
CREATE TABLE public.project_billing_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  amount_excl_gst NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  amount_incl_gst NUMERIC NOT NULL DEFAULT 0,
  trigger_event TEXT NOT NULL DEFAULT 'Custom',
  gst_applicable BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_id UUID NULL,
  billed_date DATE NULL,
  received_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, milestone_number)
);

-- Add milestones_locked to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS milestones_locked BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.project_billing_milestones ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view billing milestones"
  ON public.project_billing_milestones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Finance and directors can manage billing milestones"
  ON public.project_billing_milestones FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN (
      'super_admin', 'managing_director', 'finance_director', 'finance_manager',
      'sales_director', 'planning_engineer'
    )
  );

CREATE POLICY "Finance and directors can update billing milestones"
  ON public.project_billing_milestones FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN (
      'super_admin', 'managing_director', 'finance_director', 'finance_manager'
    )
  );

CREATE POLICY "Only MD can delete billing milestones"
  ON public.project_billing_milestones FOR DELETE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('super_admin', 'managing_director')
  );

-- Trigger for updated_at
CREATE TRIGGER update_billing_milestones_updated_at
  BEFORE UPDATE ON public.project_billing_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_billing_milestones_project ON public.project_billing_milestones(project_id);
