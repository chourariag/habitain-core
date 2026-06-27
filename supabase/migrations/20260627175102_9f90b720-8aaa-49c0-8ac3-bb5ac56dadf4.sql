
CREATE TABLE public.special_material_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  material_category TEXT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal','urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','issued')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  issued_by UUID,
  issued_at TIMESTAMPTZ,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_smr_project ON public.special_material_requests(project_id);
CREATE INDEX idx_smr_status ON public.special_material_requests(status);

GRANT SELECT, INSERT, UPDATE ON public.special_material_requests TO authenticated;
GRANT ALL ON public.special_material_requests TO service_role;

ALTER TABLE public.special_material_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smr_select" ON public.special_material_requests
  FOR SELECT TO authenticated
  USING (
    public.user_has_any_role(auth.uid(), ARRAY[
      'super_admin','managing_director','finance_director','head_operations',
      'production_head','planning_head','costing_engineer','stores_executive',
      'factory_floor_supervisor','procurement'
    ]::app_role[])
  );

CREATE POLICY "smr_insert_supervisor" ON public.special_material_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.user_has_any_role(auth.uid(), ARRAY[
      'factory_floor_supervisor','super_admin','managing_director'
    ]::app_role[])
  );

CREATE POLICY "smr_update_approver_issuer" ON public.special_material_requests
  FOR UPDATE TO authenticated
  USING (
    public.user_has_any_role(auth.uid(), ARRAY[
      'super_admin','managing_director','head_operations',
      'production_head','stores_executive'
    ]::app_role[])
  )
  WITH CHECK (
    public.user_has_any_role(auth.uid(), ARRAY[
      'super_admin','managing_director','head_operations',
      'production_head','stores_executive'
    ]::app_role[])
  );

CREATE TRIGGER update_smr_updated_at
  BEFORE UPDATE ON public.special_material_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification trigger
CREATE OR REPLACE FUNCTION public.smr_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pname TEXT;
  recip RECORD;
  recent_count INT;
  msg TEXT;
BEGIN
  SELECT project_name INTO pname FROM public.projects WHERE id = NEW.project_id;

  IF TG_OP = 'INSERT' THEN
    msg := 'Special material request — ' || COALESCE(pname,'project') || ': ' ||
           NEW.material_name || ' x' || NEW.quantity || ' ' || NEW.unit ||
           '. Reason: ' || NEW.reason ||
           CASE WHEN NEW.urgency = 'urgent' THEN ' [URGENT]' ELSE '' END;
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('production_head','managing_director','head_operations')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id,
              CASE WHEN NEW.urgency='urgent' THEN 'warning' ELSE 'info' END,
              'material', 'Special material request', msg, msg,
              '/production?project=' || NEW.project_id || '&tab=special-materials',
              CASE WHEN NEW.urgency='urgent' THEN 'high' ELSE 'normal' END);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      msg := 'Special material approved — ' || COALESCE(pname,'project') || ': ' ||
             NEW.material_name || ' x' || NEW.quantity || ' ' || NEW.unit || '. Please issue.';
      FOR recip IN SELECT auth_user_id FROM public.profiles
        WHERE is_active = true AND role IN ('stores_executive','managing_director')
      LOOP
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (recip.auth_user_id, 'success', 'material',
                'Issue special material', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'high');
      END LOOP;
      -- Notify the requester
      IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (NEW.created_by, 'success', 'material',
                'Special material request approved', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;

      -- Rolling 30-day count check
      SELECT count(*) INTO recent_count
        FROM public.special_material_requests
        WHERE project_id = NEW.project_id
          AND status = 'approved'
          AND approved_at >= now() - INTERVAL '30 days';
      IF recent_count > 3 THEN
        FOR recip IN SELECT auth_user_id FROM public.profiles
          WHERE is_active = true AND role IN ('planning_head','managing_director','head_operations')
        LOOP
          INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
          VALUES (recip.auth_user_id, 'warning', 'material',
                  'Excess special material requests',
                  '⚠️ ' || COALESCE(pname,'Project') || ' has ' || recent_count ||
                  ' special material requests this month. Review BOQ or design for potential gaps.',
                  '⚠️ ' || COALESCE(pname,'Project') || ' has ' || recent_count ||
                  ' special material requests this month. Review BOQ or design for potential gaps.',
                  '/production?project=' || NEW.project_id || '&tab=special-materials', 'high');
        END LOOP;
      END IF;
    ELSIF NEW.status = 'rejected' THEN
      msg := 'Special material request rejected — ' || COALESCE(pname,'project') || ': ' ||
             NEW.material_name || '. Reason: ' || COALESCE(NEW.rejection_reason,'(none)');
      IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (NEW.created_by, 'warning', 'material',
                'Special material request rejected', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;
    ELSIF NEW.status = 'issued' THEN
      msg := 'Special material issued — ' || COALESCE(pname,'project') || ': ' ||
             NEW.material_name || ' x' || NEW.quantity || ' ' || NEW.unit || '.';
      FOR recip IN SELECT auth_user_id FROM public.profiles
        WHERE is_active = true AND role IN ('costing_engineer','production_head','planning_head','managing_director')
      LOOP
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (recip.auth_user_id, 'info', 'material',
                'Special material issued', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END LOOP;
      IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (NEW.created_by, 'success', 'material',
                'Special material issued', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_smr_notify
  AFTER INSERT OR UPDATE ON public.special_material_requests
  FOR EACH ROW EXECUTE FUNCTION public.smr_notify();
