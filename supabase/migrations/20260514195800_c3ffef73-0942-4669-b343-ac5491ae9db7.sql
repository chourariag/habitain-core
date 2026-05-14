-- Floor plans
CREATE TABLE public.floor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  floor_name text NOT NULL,
  file_url text NOT NULL,
  storage_path text,
  uploaded_by uuid REFERENCES auth.users(id),
  is_locked boolean NOT NULL DEFAULT false,
  ai_analysis_status text NOT NULL DEFAULT 'pending', -- pending|processing|done|failed
  ai_analysis_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_floor_plans_project ON public.floor_plans(project_id);

-- Photo positions
CREATE TABLE public.photo_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id uuid NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position_number integer NOT NULL,
  area_name text NOT NULL,
  floor_name text NOT NULL,
  direction text, -- N|S|E|W|NE|NW|SE|SW
  is_mandatory boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'ai', -- ai|manual
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_photo_positions_project ON public.photo_positions(project_id);
CREATE INDEX idx_photo_positions_floor ON public.photo_positions(floor_plan_id);

-- Site position photos
CREATE TABLE public.site_position_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  diary_id uuid REFERENCES public.site_diary(id) ON DELETE SET NULL,
  position_id uuid NOT NULL REFERENCES public.photo_positions(id) ON DELETE CASCADE,
  photo_date date NOT NULL DEFAULT CURRENT_DATE,
  file_url text NOT NULL,
  storage_path text,
  gps_lat numeric,
  gps_lng numeric,
  ai_analysis_result jsonb,
  ai_flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ai_severity text, -- info|minor|major
  dismissed_flags jsonb, -- [{flag, reason, by, at}]
  submitted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_position_photos_project_date ON public.site_position_photos(project_id, photo_date DESC);
CREATE INDEX idx_site_position_photos_position ON public.site_position_photos(position_id, photo_date DESC);

-- updated_at triggers
CREATE TRIGGER trg_floor_plans_updated BEFORE UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_photo_positions_updated BEFORE UPDATE ON public.photo_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_position_photos ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.can_manage_floor_plan(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','site_installation_mgr','operations_architect','project_architect','principal_architect','head_operations')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_capture_site_photo(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','site_engineer','site_installation_mgr','head_operations')
  )
$$;

-- Policies: floor_plans
CREATE POLICY "view_floor_plans_authed" ON public.floor_plans FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_floor_plans" ON public.floor_plans FOR INSERT
  WITH CHECK (public.can_manage_floor_plan(auth.uid()));
CREATE POLICY "update_floor_plans" ON public.floor_plans FOR UPDATE
  USING (
    public.is_md(auth.uid())
    OR (public.can_manage_floor_plan(auth.uid()) AND (is_locked = false OR uploaded_by = auth.uid()))
  );
CREATE POLICY "delete_floor_plans_md" ON public.floor_plans FOR DELETE
  USING (public.is_md(auth.uid()));

-- Policies: photo_positions
CREATE POLICY "view_photo_positions_authed" ON public.photo_positions FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_photo_positions" ON public.photo_positions FOR INSERT
  WITH CHECK (public.can_manage_floor_plan(auth.uid()));
CREATE POLICY "update_photo_positions" ON public.photo_positions FOR UPDATE
  USING (public.can_manage_floor_plan(auth.uid()));
CREATE POLICY "delete_photo_positions" ON public.photo_positions FOR DELETE
  USING (public.can_manage_floor_plan(auth.uid()));

-- Policies: site_position_photos
CREATE POLICY "view_site_position_photos_authed" ON public.site_position_photos FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_site_position_photos" ON public.site_position_photos FOR INSERT
  WITH CHECK (public.can_capture_site_photo(auth.uid()));
CREATE POLICY "update_site_position_photos_flags" ON public.site_position_photos FOR UPDATE
  USING (public.can_manage_floor_plan(auth.uid()) OR public.can_capture_site_photo(auth.uid()));
CREATE POLICY "delete_site_position_photos_admin" ON public.site_position_photos FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Storage bucket for floor plans (public, like other site assets)
INSERT INTO storage.buckets (id, name, public)
VALUES ('floor-plans', 'floor-plans', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "floor_plans_read_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'floor-plans');
CREATE POLICY "floor_plans_upload_authed" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'floor-plans' AND auth.uid() IS NOT NULL);
CREATE POLICY "floor_plans_update_authed" ON storage.objects FOR UPDATE
  USING (bucket_id = 'floor-plans' AND auth.uid() IS NOT NULL);