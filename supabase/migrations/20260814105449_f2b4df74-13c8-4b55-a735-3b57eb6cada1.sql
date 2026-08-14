CREATE OR REPLACE FUNCTION public.assign_wo_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pcode text;
  ym text;
  seq integer;
BEGIN
  IF NEW.wo_number IS NOT NULL AND NEW.wo_number <> '' THEN
    RETURN NEW;
  END IF;

  pcode := upper(substr(replace(COALESCE(NEW.project_id::text,''),'-',''),1,8));
  ym := to_char(now(), 'YY-MM');

  INSERT INTO public.work_order_sequences (project_id, yearmonth, last_seq)
  VALUES (NEW.project_id, ym, 1)
  ON CONFLICT (project_id, yearmonth) DO UPDATE SET last_seq = work_order_sequences.last_seq + 1
  RETURNING last_seq INTO seq;

  NEW.wo_number := 'WO/' || COALESCE(NULLIF(pcode,''),'PROJ') || '/' || ym || '/' || lpad(seq::text, 3, '0');
  RETURN NEW;
END;
$$;