-- 1. Add planned_activities and daily_summary to site_diary
ALTER TABLE public.site_diary
ADD COLUMN planned_activities jsonb NULL,
ADD COLUMN daily_summary text NULL;

-- 2. Create site_receipt_checklist table
CREATE TABLE public.site_receipt_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  physical_condition_checked boolean DEFAULT false,
  physical_condition_photo_url text NULL,
  module_ids_verified boolean DEFAULT false,
  dispatch_docs_checked boolean DEFAULT false,
  transport_damage_found boolean DEFAULT false,
  transport_damage_description text NULL,
  transport_damage_photos text[] DEFAULT '{}',
  submitted_by uuid NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  is_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.site_receipt_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view site receipt checklists"
ON public.site_receipt_checklist FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert site receipt checklists"
ON public.site_receipt_checklist FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update site receipt checklists"
ON public.site_receipt_checklist FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_site_receipt_checklist_updated_at
BEFORE UPDATE ON public.site_receipt_checklist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create subcontractor_schedules table
CREATE TABLE public.subcontractor_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor_name text NOT NULL,
  start_date date NOT NULL,
  confirmed boolean DEFAULT false,
  confirmed_at timestamptz NULL,
  reminder_14d_sent boolean DEFAULT false,
  reminder_5d_sent boolean DEFAULT false,
  reminder_1d_sent boolean DEFAULT false,
  escalation_sent boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subcontractor_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subcontractor schedules"
ON public.subcontractor_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert subcontractor schedules"
ON public.subcontractor_schedules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update subcontractor schedules"
ON public.subcontractor_schedules FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_subcontractor_schedules_updated_at
BEFORE UPDATE ON public.subcontractor_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();