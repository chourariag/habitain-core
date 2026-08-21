CREATE TABLE public.labour_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  work_order_id uuid REFERENCES public.work_orders(id),
  project_id uuid REFERENCES public.projects(id),
  subcontractor_id uuid REFERENCES public.subcontractors(id),
  amount_total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  raised_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  raised_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  checklist_completed_at timestamptz,
  checklist_completed_by uuid REFERENCES auth.users(id),
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labour_invoices_status_chk CHECK (status IN ('draft','checklist_pending','approved','sent','partially_paid','fully_paid'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_invoices TO authenticated;
GRANT ALL ON public.labour_invoices TO service_role;
ALTER TABLE public.labour_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.labour_invoice_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_invoice_id uuid NOT NULL REFERENCES public.labour_invoices(id) ON DELETE CASCADE,
  item_label text NOT NULL,
  is_auto boolean NOT NULL DEFAULT false,
  is_met boolean NOT NULL DEFAULT false,
  evidence_url text,
  ticked_by uuid REFERENCES auth.users(id),
  ticked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_invoice_checklist_items TO authenticated;
GRANT ALL ON public.labour_invoice_checklist_items TO service_role;
ALTER TABLE public.labour_invoice_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_labour_invoices_wo ON public.labour_invoices (work_order_id);
CREATE INDEX idx_labour_invoice_items_inv ON public.labour_invoice_checklist_items (labour_invoice_id);

CREATE OR REPLACE FUNCTION public.can_approve_labour_invoice(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager','production_head','head_operations')
  )
$$;

CREATE POLICY "li_view" ON public.labour_invoices FOR SELECT TO authenticated
  USING (public.can_view_work_orders(auth.uid()));
CREATE POLICY "li_insert" ON public.labour_invoices FOR INSERT TO authenticated
  WITH CHECK (public.can_raise_work_order(auth.uid()) OR public.can_approve_labour_invoice(auth.uid()));
CREATE POLICY "li_update" ON public.labour_invoices FOR UPDATE TO authenticated
  USING (public.can_raise_work_order(auth.uid()) OR public.can_approve_labour_invoice(auth.uid()))
  WITH CHECK (public.can_raise_work_order(auth.uid()) OR public.can_approve_labour_invoice(auth.uid()));

CREATE POLICY "lici_view" ON public.labour_invoice_checklist_items FOR SELECT TO authenticated
  USING (public.can_view_work_orders(auth.uid()));
CREATE POLICY "lici_insert" ON public.labour_invoice_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.can_raise_work_order(auth.uid()) OR public.can_approve_labour_invoice(auth.uid()));
CREATE POLICY "lici_update" ON public.labour_invoice_checklist_items FOR UPDATE TO authenticated
  USING (public.can_raise_work_order(auth.uid()) OR public.can_approve_labour_invoice(auth.uid()))
  WITH CHECK (public.can_raise_work_order(auth.uid()) OR public.can_approve_labour_invoice(auth.uid()));

CREATE TRIGGER trg_labour_invoices_updated_at BEFORE UPDATE ON public.labour_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_labour_invoice_items_updated_at BEFORE UPDATE ON public.labour_invoice_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.labour_invoice_gate_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND OLD.status IN ('draft','checklist_pending')
     AND NEW.status NOT IN ('draft','checklist_pending')
  THEN
    IF EXISTS (
      SELECT 1 FROM public.labour_invoice_checklist_items
      WHERE labour_invoice_id = NEW.id AND is_met = false
    ) THEN
      RAISE EXCEPTION 'Sequential gate: labour invoice cannot move to approved/sent until all checklist items are met';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_labour_invoice_gate_guard BEFORE UPDATE ON public.labour_invoices
  FOR EACH ROW EXECUTE FUNCTION public.labour_invoice_gate_guard();