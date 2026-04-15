
-- Scope of Work header per project
CREATE TABLE public.project_scope_of_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_name TEXT,
  location TEXT,
  category TEXT, -- Residential / Commercial / Resort
  division TEXT, -- Habitainer / ADS
  built_up_area NUMERIC,
  module_count INTEGER,
  deck_area NUMERIC,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft / finalised
  pdf_url TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_scope_of_work ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scope" ON public.project_scope_of_work
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert scope" ON public.project_scope_of_work
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update scope" ON public.project_scope_of_work
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete scope" ON public.project_scope_of_work
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_scope_updated_at BEFORE UPDATE ON public.project_scope_of_work
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scope line items (sections 2-5)
CREATE TABLE public.project_scope_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID NOT NULL REFERENCES public.project_scope_of_work(id) ON DELETE CASCADE,
  section TEXT NOT NULL, -- design_consultants / builder_finish / external_structures / site_related
  item_name TEXT NOT NULL,
  responsibility TEXT NOT NULL DEFAULT 'not_in_scope', -- not_in_scope / habitainer / external_contractor
  area_sqft NUMERIC,
  remarks TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_scope_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scope items" ON public.project_scope_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert scope items" ON public.project_scope_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update scope items" ON public.project_scope_items
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete scope items" ON public.project_scope_items
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_scope_items_updated_at BEFORE UPDATE ON public.project_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Exclusions (section 6)
CREATE TABLE public.project_scope_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID NOT NULL REFERENCES public.project_scope_of_work(id) ON DELETE CASCADE,
  exclusion_text TEXT NOT NULL,
  is_standard BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_scope_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view exclusions" ON public.project_scope_exclusions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert exclusions" ON public.project_scope_exclusions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update exclusions" ON public.project_scope_exclusions
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete exclusions" ON public.project_scope_exclusions
  FOR DELETE TO authenticated USING (true);
