
CREATE TABLE public.client_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  visit_time TIME,
  client_name TEXT NOT NULL,
  client_feedback TEXT,
  commitments_made TEXT NOT NULL CHECK (length(trim(commitments_made)) > 0),
  follow_up_action TEXT,
  commitments_status TEXT NOT NULL DEFAULT 'open' CHECK (commitments_status IN ('open','closed')),
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  last_alerted_at TIMESTAMPTZ,
  logged_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cv_project ON public.client_visits(project_id);
CREATE INDEX idx_cv_status ON public.client_visits(commitments_status);

GRANT SELECT, INSERT, UPDATE ON public.client_visits TO authenticated;
GRANT ALL ON public.client_visits TO service_role;

ALTER TABLE public.client_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cv_select" ON public.client_visits
  FOR SELECT TO authenticated
  USING (
    public.user_has_any_role(auth.uid(), ARRAY[
      'super_admin','managing_director','head_operations',
      'head_of_projects','production_head','planning_head',
      'site_installation_mgr','site_engineer'
    ]::app_role[])
  );

CREATE POLICY "cv_insert_site" ON public.client_visits
  FOR INSERT TO authenticated
  WITH CHECK (
    logged_by = auth.uid()
    AND public.user_has_any_role(auth.uid(), ARRAY[
      'site_installation_mgr','site_engineer','super_admin','managing_director'
    ]::app_role[])
  );

CREATE POLICY "cv_update_site" ON public.client_visits
  FOR UPDATE TO authenticated
  USING (
    public.user_has_any_role(auth.uid(), ARRAY[
      'site_installation_mgr','site_engineer','super_admin','managing_director','head_of_projects'
    ]::app_role[])
  )
  WITH CHECK (
    public.user_has_any_role(auth.uid(), ARRAY[
      'site_installation_mgr','site_engineer','super_admin','managing_director','head_of_projects'
    ]::app_role[])
  );

CREATE TRIGGER update_cv_updated_at
  BEFORE UPDATE ON public.client_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify on insert
CREATE OR REPLACE FUNCTION public.cv_notify_logged()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pname TEXT; recip RECORD; msg TEXT;
BEGIN
  SELECT project_name INTO pname FROM public.projects WHERE id = NEW.project_id;
  msg := 'Client visit logged — ' || COALESCE(pname,'project') || ' on ' ||
         to_char(NEW.visit_date,'DD/MM/YYYY') || '. Commitments: ' || NEW.commitments_made;
  FOR recip IN SELECT auth_user_id FROM public.profiles
    WHERE is_active = true AND role IN ('head_of_projects','production_head','managing_director')
  LOOP
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (recip.auth_user_id, 'info', 'client_visit',
            'Client visit logged', msg, msg,
            '/site-hub?project=' || NEW.project_id || '&tab=client-visits', 'normal');
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_cv_notify_logged
  AFTER INSERT ON public.client_visits
  FOR EACH ROW EXECUTE FUNCTION public.cv_notify_logged();

-- Daily overdue alert function (run via cron / manual)
CREATE OR REPLACE FUNCTION public.cv_alert_overdue_commitments()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; recip RECORD; pname TEXT; msg TEXT; sent INT := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.client_visits
    WHERE commitments_status = 'open'
      AND created_at < now() - INTERVAL '48 hours'
      AND (last_alerted_at IS NULL OR last_alerted_at < now() - INTERVAL '20 hours')
  LOOP
    SELECT project_name INTO pname FROM public.projects WHERE id = r.project_id;
    msg := 'Client commitment open for 48+ hours — ' || COALESCE(pname,'project') ||
           ': ' || r.commitments_made || '. Logged on ' || to_char(r.visit_date,'DD/MM/YYYY') || '.';
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('head_of_projects','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'warning', 'client_visit',
              'Open client commitment 48h+', msg, msg,
              '/site-hub?project=' || r.project_id || '&tab=client-visits', 'high');
      sent := sent + 1;
    END LOOP;
    UPDATE public.client_visits SET last_alerted_at = now() WHERE id = r.id;
  END LOOP;
  RETURN sent;
END $$;
