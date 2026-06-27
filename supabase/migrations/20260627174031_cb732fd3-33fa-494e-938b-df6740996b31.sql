
-- Vendor Quotation Module
CREATE TABLE public.quotation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_category TEXT,
  line_item_description TEXT NOT NULL,
  unit TEXT,
  boq_quantity NUMERIC NOT NULL DEFAULT 0,
  boq_unit_rate NUMERIC NOT NULL DEFAULT 0,
  boq_total NUMERIC GENERATED ALWAYS AS (boq_quantity * boq_unit_rate) STORED,
  minimum_quotes_required INT NOT NULL DEFAULT 0,
  quotes_received_count INT NOT NULL DEFAULT 0,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','approved','rejected')),
  rejection_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_requests TO authenticated;
GRANT ALL ON public.quotation_requests TO service_role;
ALTER TABLE public.quotation_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vendor_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_request_id UUID NOT NULL REFERENCES public.quotation_requests(id) ON DELETE CASCADE,
  vendor_id TEXT,
  vendor_name TEXT NOT NULL,
  unit_rate NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0,
  delivery_date DATE,
  payment_terms TEXT,
  quote_file_url TEXT,
  quote_filename TEXT,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  sayeed_notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_quotes TO authenticated;
GRANT ALL ON public.vendor_quotes TO service_role;
ALTER TABLE public.vendor_quotes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.quotation_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_request_id UUID NOT NULL REFERENCES public.quotation_requests(id) ON DELETE CASCADE,
  approved_vendor_quote_id UUID NOT NULL REFERENCES public.vendor_quotes(id) ON DELETE CASCADE,
  approved_by UUID,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  variance_vs_boq_percent NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_approvals TO authenticated;
GRANT ALL ON public.quotation_approvals TO service_role;
ALTER TABLE public.quotation_approvals ENABLE ROW LEVEL SECURITY;

-- Helper: who can access the quotations module
CREATE OR REPLACE FUNCTION public.can_view_quotations(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY[
    'super_admin','managing_director','finance_director','head_operations',
    'procurement','costing_engineer','planning_head','planning_engineer'
  ]::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_manage_quotations(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY[
    'super_admin','managing_director','procurement'
  ]::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_approve_quotations(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY[
    'super_admin','managing_director','costing_engineer'
  ]::app_role[])
$$;

-- Policies
CREATE POLICY qr_select ON public.quotation_requests FOR SELECT TO authenticated
  USING (public.can_view_quotations(auth.uid()));
CREATE POLICY qr_insert ON public.quotation_requests FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_quotations(auth.uid()));
CREATE POLICY qr_update ON public.quotation_requests FOR UPDATE TO authenticated
  USING (public.can_manage_quotations(auth.uid()) OR public.can_approve_quotations(auth.uid()) OR public.has_role(auth.uid(),'planning_head'))
  WITH CHECK (public.can_manage_quotations(auth.uid()) OR public.can_approve_quotations(auth.uid()) OR public.has_role(auth.uid(),'planning_head'));
CREATE POLICY qr_delete ON public.quotation_requests FOR DELETE TO authenticated
  USING (public.is_md(auth.uid()));

CREATE POLICY vq_select ON public.vendor_quotes FOR SELECT TO authenticated
  USING (public.can_view_quotations(auth.uid()));
CREATE POLICY vq_insert ON public.vendor_quotes FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_quotations(auth.uid()));
CREATE POLICY vq_update ON public.vendor_quotes FOR UPDATE TO authenticated
  USING (public.can_manage_quotations(auth.uid()) OR public.can_approve_quotations(auth.uid()))
  WITH CHECK (public.can_manage_quotations(auth.uid()) OR public.can_approve_quotations(auth.uid()));
CREATE POLICY vq_delete ON public.vendor_quotes FOR DELETE TO authenticated
  USING (public.can_manage_quotations(auth.uid()));

CREATE POLICY qa_select ON public.quotation_approvals FOR SELECT TO authenticated
  USING (public.can_view_quotations(auth.uid()));
CREATE POLICY qa_insert ON public.quotation_approvals FOR INSERT TO authenticated
  WITH CHECK (public.can_approve_quotations(auth.uid()));
CREATE POLICY qa_delete ON public.quotation_approvals FOR DELETE TO authenticated
  USING (public.is_md(auth.uid()));

-- Triggers
CREATE OR REPLACE FUNCTION public.qr_set_min_quotes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_v NUMERIC;
BEGIN
  total_v := COALESCE(NEW.boq_quantity,0) * COALESCE(NEW.boq_unit_rate,0);
  NEW.minimum_quotes_required := CASE
    WHEN total_v < 3000 THEN 0
    WHEN total_v <= 7000 THEN 1
    ELSE 3
  END;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_qr_set_min_quotes
  BEFORE INSERT OR UPDATE OF boq_quantity, boq_unit_rate ON public.quotation_requests
  FOR EACH ROW EXECUTE FUNCTION public.qr_set_min_quotes();

CREATE OR REPLACE FUNCTION public.vq_recount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid UUID;
BEGIN
  rid := COALESCE(NEW.quotation_request_id, OLD.quotation_request_id);
  UPDATE public.quotation_requests
    SET quotes_received_count = (SELECT count(*) FROM public.vendor_quotes WHERE quotation_request_id = rid),
        updated_at = now()
    WHERE id = rid;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_vq_recount
  AFTER INSERT OR DELETE ON public.vendor_quotes
  FOR EACH ROW EXECUTE FUNCTION public.vq_recount();

-- Submit for review notifications
CREATE OR REPLACE FUNCTION public.qr_notify_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pname TEXT;
  recip RECORD;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT project_name INTO pname FROM public.projects WHERE id = NEW.project_id;

  IF NEW.status = 'under_review' THEN
    -- Notify costing engineers
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('costing_engineer','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'quotation',
              'Quotation awaiting review',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' is ready for review.',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' is ready for review.',
              '/procurement?tab=quotations&request=' || NEW.id,
              'normal');
    END LOOP;
    -- If below minimum, notify planning_head
    IF NEW.quotes_received_count < NEW.minimum_quotes_required THEN
      FOR recip IN SELECT auth_user_id FROM public.profiles
        WHERE is_active = true AND role IN ('planning_head','managing_director')
      LOOP
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (recip.auth_user_id, 'warning', 'quotation',
                'Quotation below minimum quotes',
                COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' has only ' ||
                  NEW.quotes_received_count || ' quote(s) instead of minimum ' || NEW.minimum_quotes_required ||
                  '. Reason: ' || COALESCE(NEW.remarks,'(none)') || '. Review if acceptable.',
                COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' has only ' ||
                  NEW.quotes_received_count || ' quote(s) instead of minimum ' || NEW.minimum_quotes_required ||
                  '. Reason: ' || COALESCE(NEW.remarks,'(none)') || '. Review if acceptable.',
                '/procurement?tab=quotations&request=' || NEW.id,
                'high');
      END LOOP;
    END IF;
  ELSIF NEW.status = 'approved' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (NEW.created_by, 'success', 'quotation',
            'Vendor selection approved',
            'Approved for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Create PO in Tally.',
            'Approved for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Create PO in Tally.',
            '/procurement?tab=quotations&request=' || NEW.id,
            'high');
  ELSIF NEW.status = 'rejected' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (NEW.created_by, 'warning', 'quotation',
            'Quotation rejected',
            'Rejected for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Reason: ' || COALESCE(NEW.rejection_reason,'(none)'),
            'Rejected for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Reason: ' || COALESCE(NEW.rejection_reason,'(none)'),
            '/procurement?tab=quotations&request=' || NEW.id,
            'high');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_qr_notify_status
  AFTER UPDATE OF status ON public.quotation_requests
  FOR EACH ROW EXECUTE FUNCTION public.qr_notify_status();

CREATE TRIGGER update_quotation_requests_updated_at
  BEFORE UPDATE ON public.quotation_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendor_quotes_updated_at
  BEFORE UPDATE ON public.vendor_quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_qr_project ON public.quotation_requests(project_id);
CREATE INDEX idx_qr_status ON public.quotation_requests(status);
CREATE INDEX idx_vq_request ON public.vendor_quotes(quotation_request_id);
CREATE INDEX idx_qa_request ON public.quotation_approvals(quotation_request_id);

-- Storage policies for vendor-quotes private bucket
CREATE POLICY "vendor_quotes_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-quotes' AND public.can_view_quotations(auth.uid()));
CREATE POLICY "vendor_quotes_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-quotes' AND public.can_manage_quotations(auth.uid()));
CREATE POLICY "vendor_quotes_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-quotes' AND public.can_manage_quotations(auth.uid()));
CREATE POLICY "vendor_quotes_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-quotes' AND public.can_manage_quotations(auth.uid()));
