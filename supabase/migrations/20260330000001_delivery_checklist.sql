-- Add site_ready_confirmed flag to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS site_ready_confirmed boolean NOT NULL DEFAULT false;

-- Delivery checklists table
CREATE TABLE IF NOT EXISTS public.delivery_checklists (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status                  text NOT NULL DEFAULT 'in_progress',
  site_ready_confirmed_at timestamptz,

  modules_checklist       jsonb,
  modules_signed_by       uuid REFERENCES auth.users(id),
  modules_signed_at       timestamptz,

  tools_checklist         jsonb,
  tools_signed_by         uuid REFERENCES auth.users(id),
  tools_signed_at         timestamptz,

  additional_materials    jsonb,
  additional_signed_by    uuid REFERENCES auth.users(id),
  additional_signed_at    timestamptz,

  dispatch_confirmed_at   timestamptz,
  dispatch_confirmed_by   uuid REFERENCES auth.users(id),

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.delivery_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read delivery checklists"
  ON public.delivery_checklists FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authorised roles can insert delivery checklists"
  ON public.delivery_checklists FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE auth_user_id = auth.uid())
    IN ('factory_floor_supervisor','production_head','stores_executive',
        'site_installation_mgr','super_admin','managing_director')
  );

CREATE POLICY "Authorised roles can update delivery checklists"
  ON public.delivery_checklists FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE auth_user_id = auth.uid())
    IN ('factory_floor_supervisor','production_head','stores_executive',
        'site_installation_mgr','super_admin','managing_director')
  );
