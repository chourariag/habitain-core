
-- Add share_with_client and milestone_tag to site_diary
ALTER TABLE public.site_diary 
  ADD COLUMN IF NOT EXISTS share_with_client boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS milestone_tag text;

-- Create client milestone photos table
CREATE TABLE public.client_milestone_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_name text NOT NULL,
  photo_url text NOT NULL,
  completed_at timestamp with time zone,
  shared_by text,
  diary_entry_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.client_milestone_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view milestone photos" ON public.client_milestone_photos
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage milestone photos" ON public.client_milestone_photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create construction journal table
CREATE TABLE public.construction_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  diary_entry_id uuid,
  note text NOT NULL,
  photo_url text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  shared_by text,
  shared_by_id uuid,
  is_approved boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.construction_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view journal entries" ON public.construction_journal
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage journal entries" ON public.construction_journal
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add client-facing columns to variation_orders
ALTER TABLE public.variation_orders
  ADD COLUMN IF NOT EXISTS client_facing_description text,
  ADD COLUMN IF NOT EXISTS client_facing_reason text,
  ADD COLUMN IF NOT EXISTS client_approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS client_approved_by_name text,
  ADD COLUMN IF NOT EXISTS client_query_text text,
  ADD COLUMN IF NOT EXISTS client_query_responded boolean DEFAULT false;

-- Add indexes
CREATE INDEX idx_milestone_photos_project ON public.client_milestone_photos(project_id);
CREATE INDEX idx_construction_journal_project ON public.construction_journal(project_id);
CREATE INDEX idx_site_diary_share ON public.site_diary(share_with_client) WHERE share_with_client = true;
