# PARITY-2B SQL before and after

Only these three SQL functions changed; originals are in parity2_backup.

## can_access_labour_compensation(uuid)

### Before
```sql
CREATE OR REPLACE FUNCTION public.can_access_labour_compensation(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager','hr_executive')
  )
$function$

```

### After
```sql
CREATE OR REPLACE FUNCTION public.can_access_labour_compensation(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND (public.is_tier1_or_super(_user_id) OR role IN ('finance_manager','hr_executive'))
  )
$function$

```

## commit_labour_master_upload(jsonb)

### Before
```sql
CREATE OR REPLACE FUNCTION public.commit_labour_master_upload(p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  entry jsonb;
  row_number integer := 0;
  code text;
  worker_name text;
  existing_name text;
  contractor_name text;
  contractor_uuid uuid;
  worker_uuid uuid;
  desired_status text;
  rate_value numeric;
  salary_value numeric;
  imported integer := 0;
BEGIN
  IF NOT COALESCE(public.get_user_role(auth.uid())::text = ANY (ARRAY['planning_head','managing_director','finance_director','sales_director','architecture_director','super_admin','head_of_projects']), false) THEN
    RAISE EXCEPTION 'Not authorized to upload the labour master' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Upload must contain a row list'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) e
    WHERE NULLIF(btrim(e->>'worker_code'),'') IS NOT NULL
    GROUP BY lower(btrim(e->>'worker_code')) HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate worker_code values in upload'; END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    row_number := row_number + 1;
    code := NULLIF(btrim(entry->>'worker_code'),'');
    worker_name := NULLIF(btrim(entry->>'name'),'');
    contractor_name := NULLIF(btrim(entry->>'contractor'),'');
    desired_status := COALESCE(NULLIF(btrim(entry->>'status'),''),'active');
    IF worker_name IS NULL OR NULLIF(btrim(entry->>'skill_type'),'') IS NULL THEN
      RAISE EXCEPTION 'Row %: name and skill_type are required', row_number + 1;
    END IF;
    IF desired_status NOT IN ('active','on_leave','inactive') THEN RAISE EXCEPTION 'Row %: invalid status', row_number + 1; END IF;
    IF NULLIF(btrim(entry->>'hourly_rate'),'') IS NOT NULL AND btrim(entry->>'hourly_rate') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Row %: hourly_rate must be numeric', row_number + 1;
    END IF;
    IF NULLIF(btrim(entry->>'monthly_salary'),'') IS NOT NULL AND btrim(entry->>'monthly_salary') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Row %: monthly_salary must be numeric', row_number + 1;
    END IF;
    rate_value := NULLIF(btrim(entry->>'hourly_rate'),'')::numeric;
    salary_value := COALESCE(NULLIF(btrim(entry->>'monthly_salary'),'')::numeric, 0);

    contractor_uuid := NULL;
    IF contractor_name IS NOT NULL THEN
      SELECT id INTO contractor_uuid FROM public.labour_contractors
      WHERE lower(btrim(company_name)) = lower(contractor_name) LIMIT 1;
      IF contractor_uuid IS NULL THEN RAISE EXCEPTION 'Row %: contractor not found', row_number + 1; END IF;
    END IF;

    worker_uuid := NULL; existing_name := NULL;
    IF code IS NOT NULL THEN
      SELECT id, name INTO worker_uuid, existing_name FROM public.labour_workers WHERE lower(worker_code) = lower(code);
    END IF;
    IF worker_uuid IS NOT NULL THEN
      IF existing_name IS DISTINCT FROM worker_name THEN
        RAISE EXCEPTION 'Row %: worker name cannot be changed for an existing code', row_number + 1;
      END IF;
      UPDATE public.labour_workers
      SET contractor_id = contractor_uuid, skill_type = btrim(entry->>'skill_type'), status = desired_status,
          deactivated_at = CASE WHEN desired_status = 'inactive' THEN COALESCE(deactivated_at, now()) ELSE NULL END,
          updated_at = now()
      WHERE id = worker_uuid;
    ELSE
      INSERT INTO public.labour_workers (worker_code, contractor_id, name, skill_type, department, status, deactivated_at)
      VALUES (code, contractor_uuid, worker_name, btrim(entry->>'skill_type'), 'site', desired_status,
              CASE WHEN desired_status = 'inactive' THEN now() ELSE NULL END)
      RETURNING id INTO worker_uuid;
    END IF;

    INSERT INTO public.labour_worker_compensation (worker_id, monthly_salary, hourly_rate)
    VALUES (worker_uuid, salary_value, rate_value)
    ON CONFLICT (worker_id) DO UPDATE
      SET monthly_salary = EXCLUDED.monthly_salary, hourly_rate = EXCLUDED.hourly_rate, updated_at = now();
    imported := imported + 1;
  END LOOP;
  RETURN imported;
END;
$function$

```

### After
```sql
CREATE OR REPLACE FUNCTION public.commit_labour_master_upload(p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  entry jsonb;
  row_number integer := 0;
  code text;
  worker_name text;
  existing_name text;
  contractor_name text;
  contractor_uuid uuid;
  worker_uuid uuid;
  desired_status text;
  rate_value numeric;
  salary_value numeric;
  imported integer := 0;
BEGIN
  IF NOT COALESCE((public.is_tier1_or_super(auth.uid()) OR public.get_user_role(auth.uid())::text = ANY (ARRAY['planning_head','head_of_projects'])), false) THEN
    RAISE EXCEPTION 'Not authorized to upload the labour master' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Upload must contain a row list'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) e
    WHERE NULLIF(btrim(e->>'worker_code'),'') IS NOT NULL
    GROUP BY lower(btrim(e->>'worker_code')) HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate worker_code values in upload'; END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    row_number := row_number + 1;
    code := NULLIF(btrim(entry->>'worker_code'),'');
    worker_name := NULLIF(btrim(entry->>'name'),'');
    contractor_name := NULLIF(btrim(entry->>'contractor'),'');
    desired_status := COALESCE(NULLIF(btrim(entry->>'status'),''),'active');
    IF worker_name IS NULL OR NULLIF(btrim(entry->>'skill_type'),'') IS NULL THEN
      RAISE EXCEPTION 'Row %: name and skill_type are required', row_number + 1;
    END IF;
    IF desired_status NOT IN ('active','on_leave','inactive') THEN RAISE EXCEPTION 'Row %: invalid status', row_number + 1; END IF;
    IF NULLIF(btrim(entry->>'hourly_rate'),'') IS NOT NULL AND btrim(entry->>'hourly_rate') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Row %: hourly_rate must be numeric', row_number + 1;
    END IF;
    IF NULLIF(btrim(entry->>'monthly_salary'),'') IS NOT NULL AND btrim(entry->>'monthly_salary') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Row %: monthly_salary must be numeric', row_number + 1;
    END IF;
    rate_value := NULLIF(btrim(entry->>'hourly_rate'),'')::numeric;
    salary_value := COALESCE(NULLIF(btrim(entry->>'monthly_salary'),'')::numeric, 0);

    contractor_uuid := NULL;
    IF contractor_name IS NOT NULL THEN
      SELECT id INTO contractor_uuid FROM public.labour_contractors
      WHERE lower(btrim(company_name)) = lower(contractor_name) LIMIT 1;
      IF contractor_uuid IS NULL THEN RAISE EXCEPTION 'Row %: contractor not found', row_number + 1; END IF;
    END IF;

    worker_uuid := NULL; existing_name := NULL;
    IF code IS NOT NULL THEN
      SELECT id, name INTO worker_uuid, existing_name FROM public.labour_workers WHERE lower(worker_code) = lower(code);
    END IF;
    IF worker_uuid IS NOT NULL THEN
      IF existing_name IS DISTINCT FROM worker_name THEN
        RAISE EXCEPTION 'Row %: worker name cannot be changed for an existing code', row_number + 1;
      END IF;
      UPDATE public.labour_workers
      SET contractor_id = contractor_uuid, skill_type = btrim(entry->>'skill_type'), status = desired_status,
          deactivated_at = CASE WHEN desired_status = 'inactive' THEN COALESCE(deactivated_at, now()) ELSE NULL END,
          updated_at = now()
      WHERE id = worker_uuid;
    ELSE
      INSERT INTO public.labour_workers (worker_code, contractor_id, name, skill_type, department, status, deactivated_at)
      VALUES (code, contractor_uuid, worker_name, btrim(entry->>'skill_type'), 'site', desired_status,
              CASE WHEN desired_status = 'inactive' THEN now() ELSE NULL END)
      RETURNING id INTO worker_uuid;
    END IF;

    INSERT INTO public.labour_worker_compensation (worker_id, monthly_salary, hourly_rate)
    VALUES (worker_uuid, salary_value, rate_value)
    ON CONFLICT (worker_id) DO UPDATE
      SET monthly_salary = EXCLUDED.monthly_salary, hourly_rate = EXCLUDED.hourly_rate, updated_at = now();
    imported := imported + 1;
  END LOOP;
  RETURN imported;
END;
$function$

```

## notify_costing_on_measurement_submit()

### Before
```sql
CREATE OR REPLACE FUNCTION public.notify_costing_on_measurement_submit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pname TEXT;
  msg TEXT;
  recip RECORD;
BEGIN
  IF NEW.trade = 'daily_site_report' THEN
    RETURN NEW;
  END IF;
  IF NEW.submitted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;
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
END $function$

```

### After
```sql
CREATE OR REPLACE FUNCTION public.notify_costing_on_measurement_submit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pname TEXT;
  msg TEXT;
  recip RECORD;
BEGIN
  IF NEW.trade = 'daily_site_report' THEN
    RETURN NEW;
  END IF;
  IF NEW.submitted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;
    msg := 'Daily measurement submitted for ' || COALESCE(pname,'project') || '. Review WIP.';
    FOR recip IN
      SELECT DISTINCT auth_user_id FROM public.profiles
      WHERE is_active = true AND auth_user_id IS NOT NULL AND (public.is_tier1(auth_user_id) OR role IN ('costing_engineer','production_head','head_operations'))
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
END $function$

```
