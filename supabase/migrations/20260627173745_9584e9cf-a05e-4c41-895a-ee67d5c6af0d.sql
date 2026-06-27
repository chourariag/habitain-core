
CREATE OR REPLACE FUNCTION public.notify_costing_on_measurement_submit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pname TEXT;
  msg TEXT;
  recip RECORD;
BEGIN
  IF NEW.submitted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    SELECT project_name INTO pname FROM public.projects WHERE id = NEW.project_id;
    msg := 'Daily measurement submitted for ' || COALESCE(pname,'project') || '. Review WIP.';
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('costing_engineer','production_head','head_operations','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'measurement',
              'Daily measurement submitted',
              msg, msg,
              '/production?project=' || NEW.project_id || '&tab=measurement',
              'normal');
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
