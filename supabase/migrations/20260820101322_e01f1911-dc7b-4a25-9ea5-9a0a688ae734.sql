
-- 1. Helper: active internal staff
CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = _user_id AND COALESCE(p.is_active, true)
  )
$$;

-- Helper: who may see internal cost/rate data
CREATE OR REPLACE FUNCTION public.can_view_commercial_rates(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = _user_id
      AND COALESCE(p.is_active, true)
      AND p.role IN (
        'super_admin','managing_director','chairman','director',
        'finance_director','sales_director','architecture_director','principal_architect',
        'head_operations','head_of_projects','planning_head','production_head',
        'finance_manager','accounts_executive',
        'planning_engineer','costing_engineer','quantity_surveyor',
        'procurement','procurement_assistant','purchase_assistant',
        'site_installation_mgr','assistant_manager'
      )
  )
$$;

-- Helper: who may see third-party driver contact details
CREATE OR REPLACE FUNCTION public.can_view_driver_contact(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = _user_id
      AND COALESCE(p.is_active, true)
      AND p.role IN (
        'super_admin','managing_director','chairman','director',
        'head_operations','production_head','logistics_manager',
        'site_installation_mgr','delivery_rm_lead','stores_executive',
        'factory_floor_supervisor','senior_factory_supervisor','factory_supervisor'
      )
  )
$$;

-- 2. Scope broad "true" SELECT policies to active internal staff
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
CREATE POLICY "Active staff can view projects" ON public.projects
  FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view project tasks" ON public.project_tasks;
CREATE POLICY "Active staff can view project tasks" ON public.project_tasks
  FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view scope" ON public.project_scope_of_work;
CREATE POLICY "Active staff can view scope" ON public.project_scope_of_work
  FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read site_diary" ON public.site_diary;
CREATE POLICY "Active staff can read site_diary" ON public.site_diary
  FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read handover_pack" ON public.handover_pack;
CREATE POLICY "Active staff can read handover_pack" ON public.handover_pack
  FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));

-- 3. Restrict internal rate/margin data
DROP POLICY IF EXISTS "Authenticated can view rate cards" ON public.rate_cards;
CREATE POLICY "Commercial roles can view rate cards" ON public.rate_cards
  FOR SELECT TO authenticated USING (public.can_view_commercial_rates(auth.uid()));

DROP POLICY IF EXISTS "Auth read benchmarks" ON public.material_rate_benchmarks;
CREATE POLICY "Commercial roles read benchmarks" ON public.material_rate_benchmarks
  FOR SELECT TO authenticated USING (public.can_view_commercial_rates(auth.uid()));

-- 4. Move driver PII out of dispatch_packs
CREATE TABLE IF NOT EXISTS public.dispatch_pack_driver_contact (
  dispatch_pack_id uuid PRIMARY KEY REFERENCES public.dispatch_packs(id) ON DELETE CASCADE,
  driver_name text,
  driver_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_pack_driver_contact TO authenticated;
GRANT ALL ON public.dispatch_pack_driver_contact TO service_role;
ALTER TABLE public.dispatch_pack_driver_contact ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logistics roles view driver contact" ON public.dispatch_pack_driver_contact
  FOR SELECT TO authenticated USING (public.can_view_driver_contact(auth.uid()));
CREATE POLICY "Logistics roles insert driver contact" ON public.dispatch_pack_driver_contact
  FOR INSERT TO authenticated WITH CHECK (public.can_view_driver_contact(auth.uid()));
CREATE POLICY "Logistics roles update driver contact" ON public.dispatch_pack_driver_contact
  FOR UPDATE TO authenticated USING (public.can_view_driver_contact(auth.uid()))
  WITH CHECK (public.can_view_driver_contact(auth.uid()));
CREATE POLICY "Admins delete driver contact" ON public.dispatch_pack_driver_contact
  FOR DELETE TO authenticated USING (public.is_full_admin(auth.uid()));

CREATE TRIGGER trg_dispatch_pack_driver_contact_updated_at
  BEFORE UPDATE ON public.dispatch_pack_driver_contact
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.dispatch_pack_driver_contact (dispatch_pack_id, driver_name, driver_phone)
SELECT id, driver_name, driver_phone FROM public.dispatch_packs
ON CONFLICT (dispatch_pack_id) DO NOTHING;

ALTER TABLE public.dispatch_packs DROP COLUMN IF EXISTS driver_name;
ALTER TABLE public.dispatch_packs DROP COLUMN IF EXISTS driver_phone;

-- 5. Storage: fail closed when a path has no resolvable project scope
CREATE OR REPLACE FUNCTION public.storage_object_project_allowed(_uid uuid, _object_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  nm   text := COALESCE(_object_name, '');
  seg1 text := split_part(COALESCE(_object_name, ''), '/', 1);
  seg2 text := split_part(COALESCE(_object_name, ''), '/', 2);
  seg  text;
  pid  uuid;
  mid  uuid;
  is_staff boolean;
BEGIN
  IF _uid IS NULL OR nm = '' THEN
    RETURN false;
  END IF;

  IF public.is_full_admin(_uid) OR public.is_director(_uid) THEN
    RETURN true;
  END IF;

  -- Personal folders: only the owning user
  IF seg1 IN ('avatars', 'expense-receipts') AND seg2 = _uid::text THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = _uid AND COALESCE(p.is_active, true)
  ) INTO is_staff;

  -- Resolve the owning project from any UUID segment in the path
  FOREACH seg IN ARRAY string_to_array(nm, '/')
  LOOP
    BEGIN
      pid := NULLIF(seg, '')::uuid;
    EXCEPTION WHEN others THEN
      pid := NULL;
    END;

    IF pid IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.projects WHERE id = pid) THEN
        RETURN COALESCE(public.user_can_access_project(_uid, pid) OR is_staff, false);
      END IF;

      SELECT m.project_id INTO mid FROM public.modules m WHERE m.id = pid;
      IF mid IS NOT NULL THEN
        RETURN COALESCE(public.user_can_access_project(_uid, mid) OR is_staff, false);
      END IF;
    END IF;
  END LOOP;

  -- No resolvable project scope: fail closed
  RETURN false;
END;
$function$;
