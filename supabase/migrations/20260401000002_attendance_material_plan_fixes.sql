-- Attendance: add location_note column + UNIQUE(user_id, date) constraint
-- Procurement: create material_plan_items table

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. location_note column on attendance_records
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS location_note text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. UNIQUE(user_id, date) — ensures one record per user per day
--    Required for the offline check-out sync fix (match by user+date, not UUID)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_records_user_id_date_key'
      AND conrelid = 'public.attendance_records'::regclass
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_user_id_date_key UNIQUE (user_id, date);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. material_plan_items table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_plan_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        REFERENCES public.projects(id),
  material_name text        NOT NULL,
  category      text        NOT NULL DEFAULT 'General',
  quantity      numeric     NOT NULL DEFAULT 0,
  unit          text        NOT NULL DEFAULT 'units',
  required_by   date,
  lead_time_days numeric    NOT NULL DEFAULT 7,
  supplier      text,
  status        text        NOT NULL DEFAULT 'planned',
  created_by    uuid        REFERENCES auth.users(id),
  is_archived   boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read material plan items"
  ON public.material_plan_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Planners can insert material plan items"
  ON public.material_plan_items FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) = ANY (ARRAY[
      'planning_engineer'::public.app_role,
      'managing_director'::public.app_role,
      'super_admin'::public.app_role,
      'production_head'::public.app_role,
      'head_operations'::public.app_role
    ])
  );

CREATE POLICY "Planners can update material plan items"
  ON public.material_plan_items FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) = ANY (ARRAY[
      'planning_engineer'::public.app_role,
      'managing_director'::public.app_role,
      'super_admin'::public.app_role,
      'production_head'::public.app_role,
      'head_operations'::public.app_role
    ])
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) = ANY (ARRAY[
      'planning_engineer'::public.app_role,
      'managing_director'::public.app_role,
      'super_admin'::public.app_role,
      'production_head'::public.app_role,
      'head_operations'::public.app_role
    ])
  );

CREATE INDEX IF NOT EXISTS idx_material_plan_items_project
  ON public.material_plan_items (project_id);
CREATE INDEX IF NOT EXISTS idx_material_plan_items_status
  ON public.material_plan_items (status);
CREATE INDEX IF NOT EXISTS idx_material_plan_items_required_by
  ON public.material_plan_items (required_by);

CREATE TRIGGER update_material_plan_items_updated_at
  BEFORE UPDATE ON public.material_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
