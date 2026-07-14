-- 1. Extend status check constraint
ALTER TABLE public.quotation_requests DROP CONSTRAINT IF EXISTS quotation_requests_status_check;
ALTER TABLE public.quotation_requests
  ADD CONSTRAINT quotation_requests_status_check
  CHECK (status = ANY (ARRAY[
    'indent_pending'::text,
    'indent_approved'::text,
    'indent_rejected'::text,
    'open'::text,
    'under_review'::text,
    'approved'::text,
    'rejected'::text,
    'escalated'::text
  ]));

-- 2. Add new columns
ALTER TABLE public.quotation_requests
  ADD COLUMN IF NOT EXISTS indent_approved_by uuid,
  ADD COLUMN IF NOT EXISTS indent_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS indent_rejection_reason text,
  ADD COLUMN IF NOT EXISTS requote_round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_to_planning_head boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- 3. Change default for new rows to indent_pending
ALTER TABLE public.quotation_requests ALTER COLUMN status SET DEFAULT 'indent_pending';

-- 4. Backfill existing rows: anything already past the pre-indent phase should be treated as indent_approved so downstream flow continues.
UPDATE public.quotation_requests
   SET indent_approved_at = COALESCE(indent_approved_at, created_at)
 WHERE status IN ('open','under_review','approved','rejected');

-- 5. Fix threshold function: <50k = 1 quote, >=50k = 3 quotes
CREATE OR REPLACE FUNCTION public.qr_set_min_quotes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE total_v NUMERIC;
BEGIN
  total_v := COALESCE(NEW.boq_quantity,0) * COALESCE(NEW.boq_unit_rate,0);
  NEW.minimum_quotes_required := CASE
    WHEN total_v < 50000 THEN 1
    ELSE 3
  END;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;

-- 6. Extend status notifications for the new states
CREATE OR REPLACE FUNCTION public.qr_notify_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pname TEXT;
  recip RECORD;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT project_name INTO pname FROM public.projects WHERE id = NEW.project_id;

  IF NEW.status = 'indent_pending' THEN
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('costing_engineer','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'quotation',
              'Indent awaiting approval',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' indent needs approval vs BOQ rate.',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' indent needs approval vs BOQ rate.',
              '/procurement?tab=quotations&request=' || NEW.id,
              'normal');
    END LOOP;

  ELSIF NEW.status = 'indent_approved' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (NEW.created_by, 'success', 'quotation',
            'Indent approved — collect vendor quotes',
            'Indent for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || ' is approved. You can now upload vendor quotes.',
            'Indent for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || ' is approved. You can now upload vendor quotes.',
            '/procurement?tab=quotations&request=' || NEW.id,
            'high');

  ELSIF NEW.status = 'indent_rejected' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (NEW.created_by, 'warning', 'quotation',
            'Indent rejected',
            'Indent rejected for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Reason: ' || COALESCE(NEW.indent_rejection_reason,'(none)'),
            'Indent rejected for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Reason: ' || COALESCE(NEW.indent_rejection_reason,'(none)'),
            '/procurement?tab=quotations&request=' || NEW.id,
            'high');

  ELSIF NEW.status = 'under_review' THEN
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
    IF NEW.quotes_received_count < NEW.minimum_quotes_required THEN
      FOR recip IN SELECT auth_user_id FROM public.profiles
        WHERE is_active = true AND role IN ('planning_head','managing_director')
      LOOP
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (recip.auth_user_id, 'warning', 'quotation',
                'Quotation below minimum quotes',
                COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' has only ' ||
                  NEW.quotes_received_count || ' quote(s) instead of minimum ' || NEW.minimum_quotes_required ||
                  '. Reason: ' || COALESCE(NEW.remarks,'(none)') || '.',
                COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' has only ' ||
                  NEW.quotes_received_count || ' quote(s) instead of minimum ' || NEW.minimum_quotes_required ||
                  '. Reason: ' || COALESCE(NEW.remarks,'(none)') || '.',
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

  ELSIF NEW.status = 'escalated' THEN
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('planning_head','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'warning', 'quotation',
              'Quotation escalated to Planning Head',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description ||
                ' has completed 2 re-quote rounds without an acceptable vendor. Final decision required.',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description ||
                ' has completed 2 re-quote rounds without an acceptable vendor. Final decision required.',
              '/procurement?tab=quotations&request=' || NEW.id,
              'high');
    END LOOP;
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (NEW.created_by, 'warning', 'quotation',
              'Quotation escalated',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description ||
                ' escalated to Planning Head after 2 re-quote rounds.',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description ||
                ' escalated to Planning Head after 2 re-quote rounds.',
              '/procurement?tab=quotations&request=' || NEW.id,
              'normal');
    END IF;
  END IF;

  RETURN NEW;
END $function$;