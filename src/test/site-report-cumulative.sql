-- Run as a privileged test session; no persistent rows are written.
BEGIN;
DO $$
DECLARE predicate text; total numeric;
BEGIN
  SELECT substring(pg_get_functiondef('public.get_site_report(uuid,date)'::regprocedure)
    FROM 'WHERE li.boq_item_id=b.id AND ([^)]*)\)') INTO predicate;
  IF predicate IS NULL THEN RAISE EXCEPTION 'Cumulative predicate not found'; END IF;
  EXECUTE 'WITH d(is_archived,trade,report_status,measurement_date,today_qty) AS (VALUES
    (false,''daily_site_report'',''submitted'',DATE ''2026-11-14'',2),
    (false,''daily_site_report'',''submitted'',DATE ''2026-11-15'',3),
    (false,''daily_site_report'',''draft'',DATE ''2026-11-15'',20),
    (false,''daily_site_report'',''submitted'',DATE ''2026-11-16'',30),
    (true,''daily_site_report'',''submitted'',DATE ''2026-11-14'',40))
    SELECT sum(today_qty) FROM d WHERE ' || replace(predicate,'p_date','DATE ''2026-11-15''') INTO total;
  IF total IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'Expected 5 from submitted reports through selected date, got %', total; END IF;
END $$;
ROLLBACK;