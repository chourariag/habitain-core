
-- Site Readiness Checklist submissions
CREATE TABLE public.site_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  submitted_by TEXT NOT NULL,
  foundation_ready BOOLEAN NOT NULL DEFAULT false,
  crane_booked BOOLEAN NOT NULL DEFAULT false,
  site_access_clear BOOLEAN NOT NULL DEFAULT false,
  team_briefed BOOLEAN NOT NULL DEFAULT false,
  safety_equipment BOOLEAN NOT NULL DEFAULT false,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read site_readiness"
  ON public.site_readiness FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert site_readiness"
  ON public.site_readiness FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update site_readiness"
  ON public.site_readiness FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Dispatch Log
CREATE TABLE public.dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  transporter_name TEXT NOT NULL,
  dispatched_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dispatch_log"
  ON public.dispatch_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert dispatch_log"
  ON public.dispatch_log FOR INSERT TO authenticated WITH CHECK (true);

-- Installation Checklist
CREATE TABLE public.installation_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  submitted_by TEXT NOT NULL,
  lifting_sequence TEXT NOT NULL DEFAULT 'pending',
  module_connections TEXT NOT NULL DEFAULT 'pending',
  mep_stitching TEXT NOT NULL DEFAULT 'pending',
  weatherproofing TEXT NOT NULL DEFAULT 'pending',
  snagging TEXT NOT NULL DEFAULT 'pending',
  lifting_photo TEXT,
  connections_photo TEXT,
  mep_photo TEXT,
  weatherproofing_photo TEXT,
  snagging_photo TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.installation_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read installation_checklist"
  ON public.installation_checklist FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert installation_checklist"
  ON public.installation_checklist FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update installation_checklist"
  ON public.installation_checklist FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Site Diary
CREATE TABLE public.site_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  gps_location TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_diary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read site_diary"
  ON public.site_diary FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert site_diary"
  ON public.site_diary FOR INSERT TO authenticated WITH CHECK (true);

-- Handover Pack
CREATE TABLE public.handover_pack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_name TEXT NOT NULL,
  snag_list TEXT,
  snag_photos TEXT[] DEFAULT '{}',
  om_document_url TEXT,
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_signoff_name TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.handover_pack ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read handover_pack"
  ON public.handover_pack FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert handover_pack"
  ON public.handover_pack FOR INSERT TO authenticated WITH CHECK (true);

-- Storage bucket for site photos
INSERT INTO storage.buckets (id, name, public) VALUES ('site-photos', 'site-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload site photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-photos');

CREATE POLICY "Anyone can read site photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-photos');
