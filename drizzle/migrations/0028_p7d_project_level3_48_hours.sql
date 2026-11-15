DO $migration$
DECLARE definition text; marker text := 'IF p_role<>''owner''';
BEGIN
SELECT pg_get_functiondef('public.update_escalation_level(text,integer,integer,text)'::regprocedure) INTO definition;
IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Expected escalation validation anchor not found'; END IF;
definition := replace(definition, marker, 'IF p_key IN (''daily_site_report'',''labour_attendance'') AND p_hours > 48 THEN RAISE EXCEPTION ''Must be 48 hours or less: reports can only be filed for 3 days.''; END IF;' || chr(10) || marker);
EXECUTE definition;
END $migration$;