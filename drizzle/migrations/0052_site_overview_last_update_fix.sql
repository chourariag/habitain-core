DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.get_site_overview(date)'::regprocedure) INTO definition;
 IF position('coalesce(sr.submitted_at,sr.updated_at)' IN definition)=0 OR position('coalesce(fr.submitted_at,fr.updated_at)' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected overview definition'; END IF;
 definition:=replace(definition,'coalesce(sr.submitted_at,sr.updated_at)','greatest(sr.submitted_at,sr.updated_at)');
 definition:=replace(definition,'coalesce(fr.submitted_at,fr.updated_at)','greatest(fr.submitted_at,fr.updated_at)');
 EXECUTE definition;
END $migration$;