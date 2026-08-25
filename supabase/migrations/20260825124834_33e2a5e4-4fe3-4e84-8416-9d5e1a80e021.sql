CREATE OR REPLACE FUNCTION public.set_smr_created_by_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  SELECT profiles.id INTO NEW.created_by
  FROM public.profiles
  WHERE profiles.auth_user_id = auth.uid();

  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'No active staff profile is linked to the signed-in user';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_smr_created_by_profile ON public.special_material_requests;
CREATE TRIGGER set_smr_created_by_profile
  BEFORE INSERT ON public.special_material_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_smr_created_by_profile();

ALTER POLICY "smr_insert_supervisor" ON public.special_material_requests
  WITH CHECK (
    created_by = (
      SELECT profiles.id
      FROM public.profiles
      WHERE profiles.auth_user_id = auth.uid()
    )
    AND public.user_has_any_role(auth.uid(), ARRAY[
      'factory_floor_supervisor',
      'production_head',
      'super_admin',
      'managing_director'
    ]::public.app_role[])
  );

CREATE OR REPLACE FUNCTION public.smr_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pname TEXT;
  recip RECORD;
  recent_count INT;
  msg TEXT;
  requester_auth_user_id UUID;
BEGIN
  SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;

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

  SELECT auth_user_id INTO requester_auth_user_id
  FROM public.profiles
  WHERE id = NEW.created_by;

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
      IF requester_auth_user_id IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (requester_auth_user_id, 'success', 'material',
                'Special material request approved', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;

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
      IF requester_auth_user_id IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (requester_auth_user_id, 'warning', 'material',
                'Special material request rejected', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;
    ELSIF NEW.status = 'issued' THEN
      msg := 'Special material issued — ' || COALESCE(pname,'project') || ': ' || NEW.material_name || '.';
      IF requester_auth_user_id IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (requester_auth_user_id, 'success', 'material',
                'Special material issued', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;