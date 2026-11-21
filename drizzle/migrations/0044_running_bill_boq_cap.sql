DO $patch$
DECLARE d text; old_work text := 'COALESCE(i.boq_rate,0) boq_rate, round(COALESCE(qa.qty,0) * COALESCE(i.boq_rate,0), 2) value'; old_total text := '''value_earned'', COALESCE((SELECT sum(value) FROM work), 0),';
BEGIN
 d := pg_get_functiondef('public.get_running_bill(uuid,date)'::regprocedure);
 IF position(old_work IN d)=0 OR position(old_total IN d)=0 THEN RAISE EXCEPTION 'Running Bill cap anchors missing'; END IF;
 d := replace(d,old_work,$work$COALESCE(i.boq_rate,0) boq_rate,
      CASE WHEN COALESCE(i.boq_qty,0)>0 THEN least(COALESCE(qa.qty,0),i.boq_qty) ELSE COALESCE(qa.qty,0) END billable_qty,
      CASE WHEN COALESCE(i.boq_qty,0)>0 THEN greatest(COALESCE(qa.qty,0)-i.boq_qty,0) ELSE 0 END excess_qty,
      round((CASE WHEN COALESCE(i.boq_qty,0)>0 THEN greatest(COALESCE(qa.qty,0)-i.boq_qty,0) ELSE 0 END)*COALESCE(i.boq_rate,0),2) excess_value,
      round((CASE WHEN COALESCE(i.boq_qty,0)>0 THEN least(COALESCE(qa.qty,0),i.boq_qty) ELSE COALESCE(qa.qty,0) END)*COALESCE(i.boq_rate,0),2) value$work$);
 d := replace(d,old_total,old_total || E'\n      ''excess_value'', COALESCE((SELECT sum(excess_value) FROM work), 0),');
 EXECUTE d;
END $patch$;