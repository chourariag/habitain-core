-- Versions table
CREATE TABLE IF NOT EXISTS public.sop_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sop_id UUID NOT NULL REFERENCES public.sop_procedures(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  role_performs TEXT,
  purpose TEXT,
  scope TEXT,
  materials_tools TEXT,
  steps TEXT,
  quality_criteria TEXT,
  common_mistakes TEXT,
  safety TEXT,
  escalation TEXT,
  edited_by UUID,
  edited_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sop_versions_sop_id ON public.sop_versions(sop_id, version_number DESC);

ALTER TABLE public.sop_versions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read versions of approved SOPs; HOD/Director of dept can read all
CREATE POLICY "Read SOP versions"
ON public.sop_versions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sop_procedures sp
    WHERE sp.id = sop_versions.sop_id
      AND (sp.status = 'approved' OR public.can_edit_sop_dept(auth.uid(), sp.department))
  )
);

-- Trigger function: snapshot on UPDATE of approved SOP if any content field changed
CREATE OR REPLACE FUNCTION public.snapshot_sop_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
  editor_name TEXT;
BEGIN
  -- Only snapshot when SOP is (or was) approved and a content field changed
  IF (NEW.status = 'approved' OR OLD.status = 'approved') AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.role_performs IS DISTINCT FROM OLD.role_performs OR
    NEW.purpose IS DISTINCT FROM OLD.purpose OR
    NEW.scope IS DISTINCT FROM OLD.scope OR
    NEW.materials_tools IS DISTINCT FROM OLD.materials_tools OR
    NEW.steps IS DISTINCT FROM OLD.steps OR
    NEW.quality_criteria IS DISTINCT FROM OLD.quality_criteria OR
    NEW.common_mistakes IS DISTINCT FROM OLD.common_mistakes OR
    NEW.safety IS DISTINCT FROM OLD.safety OR
    NEW.escalation IS DISTINCT FROM OLD.escalation
  ) THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM public.sop_versions WHERE sop_id = NEW.id;

    SELECT display_name INTO editor_name
    FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;

    INSERT INTO public.sop_versions (
      sop_id, version_number, title, role_performs, purpose, scope,
      materials_tools, steps, quality_criteria, common_mistakes, safety, escalation,
      edited_by, edited_by_name
    ) VALUES (
      NEW.id, next_version, OLD.title, OLD.role_performs, OLD.purpose, OLD.scope,
      OLD.materials_tools, OLD.steps, OLD.quality_criteria, OLD.common_mistakes, OLD.safety, OLD.escalation,
      auth.uid(), editor_name
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_sop_version ON public.sop_procedures;
CREATE TRIGGER trg_snapshot_sop_version
BEFORE UPDATE ON public.sop_procedures
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_sop_version();