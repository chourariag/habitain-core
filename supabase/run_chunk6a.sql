-- === 20260330160322_f445b03b-69bf-45c1-8d2c-28c55807f144.sql ===
-- Add file_url and uploaded_by_name to design_detail_library
ALTER TABLE public.design_detail_library
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS uploaded_by_name text;

-- Create design_qc_section_signoffs table
CREATE TABLE IF NOT EXISTS public.design_qc_section_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  section_number integer NOT NULL,
  signed_by uuid NOT NULL,
  signed_by_name text,
  signed_by_role text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, section_number)
);

ALTER TABLE public.design_qc_section_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "architects_insert_section_signoffs"
  ON public.design_qc_section_signoffs FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'principal_architect') OR
    has_role(auth.uid(), 'project_architect') OR
    is_full_admin(auth.uid())
  );

CREATE POLICY "architects_select_section_signoffs"
  ON public.design_qc_section_signoffs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'principal_architect') OR
    has_role(auth.uid(), 'project_architect') OR
    has_role(auth.uid(), 'structural_architect') OR
    is_director(auth.uid())
  );

CREATE POLICY "architects_update_section_signoffs"
  ON public.design_qc_section_signoffs FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'principal_architect') OR
    is_full_admin(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'principal_architect') OR
    is_full_admin(auth.uid())
  );

-- === 20260401000001_procurement_notifications_rls.sql ===
-- Procurement fixes: Tally PO columns, notifications table, corrected RLS

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add Tally-specific columns to purchase_orders (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS po_number          text,
  ADD COLUMN IF NOT EXISTS vendor_code        text,
  ADD COLUMN IF NOT EXISTS item_description   text,
  ADD COLUMN IF NOT EXISTS quantity           numeric,
  ADD COLUMN IF NOT EXISTS unit               text,
  ADD COLUMN IF NOT EXISTS unit_rate          numeric,
  ADD COLUMN IF NOT EXISTS total_amount       numeric,
  ADD COLUMN IF NOT EXISTS project_name       text,
  ADD COLUMN IF NOT EXISTS project_id         uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS category           text,
  ADD COLUMN IF NOT EXISTS delivery_date      date,
  ADD COLUMN IF NOT EXISTS source             text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS uploaded_by        uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_by        uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at        timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason   text;

-- Partial unique index: PO numbers must be unique when present
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_po_number_unique
  ON public.purchase_orders (po_number)
  WHERE po_number IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fix SELECT RLS — replace open USING(true) with role-based access
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view purchase orders" ON public.purchase_orders;

CREATE POLICY "Role-based PO read access"
  ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid()) = ANY (ARRAY[
      'procurement'::public.app_role,
      'stores_executive'::public.app_role,
      'production_head'::public.app_role,
      'head_operations'::public.app_role,
      'planning_engineer'::public.app_role,
      'costing_engineer'::public.app_role,
      'managing_director'::public.app_role,
      'super_admin'::public.app_role,
      'finance_director'::public.app_role,
      'sales_director'::public.app_role,
      'architecture_director'::public.app_role
    ])
    OR raised_by   = auth.uid()
    OR uploaded_by = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fix INSERT RLS — include production_head and director roles for Tally upload
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authorized users can insert purchase orders" ON public.purchase_orders;

CREATE POLICY "Authorized users can insert purchase orders"
  ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) = ANY (ARRAY[
      'procurement'::public.app_role,
      'stores_executive'::public.app_role,
      'production_head'::public.app_role,
      'managing_director'::public.app_role,
      'super_admin'::public.app_role,
      'finance_director'::public.app_role,
      'sales_director'::public.app_role,
      'architecture_director'::public.app_role
    ])
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix UPDATE RLS — allow directors to approve/reject Tally POs
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authorized users can update purchase orders" ON public.purchase_orders;

CREATE POLICY "Authorized users can update purchase orders"
  ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) = ANY (ARRAY[
      'procurement'::public.app_role,
      'stores_executive'::public.app_role,
      'managing_director'::public.app_role,
      'super_admin'::public.app_role,
      'finance_director'::public.app_role,
      'sales_director'::public.app_role,
      'architecture_director'::public.app_role
    ])
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) = ANY (ARRAY[
      'procurement'::public.app_role,
      'stores_executive'::public.app_role,
      'managing_director'::public.app_role,
      'super_admin'::public.app_role,
      'finance_director'::public.app_role,
      'sales_director'::public.app_role,
      'architecture_director'::public.app_role
    ])
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Notifications table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  message      text        NOT NULL,
  type         text        NOT NULL DEFAULT 'info',
  entity_id    uuid,
  entity_type  text,
  is_read      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

-- === 20260401000002_attendance_material_plan_fixes.sql ===
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

-- === 20260401000004_expense_fixes.sql ===
-- Add missing columns to expense_entries
ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS submission_method text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS uploaded_on_behalf_of uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rate_used numeric;

-- Add reason to hr_settings
ALTER TABLE public.hr_settings ADD COLUMN IF NOT EXISTS reason text;

-- Seed expense flag threshold
INSERT INTO public.hr_settings (key, value, status)
VALUES ('expense_flag_threshold', '5000', 'active')
ON CONFLICT (key) DO NOTHING;

-- Fix INSERT policy: allow HR/admin to insert on behalf of employees
DROP POLICY IF EXISTS "Users insert own expense entries" ON public.expense_entries;
CREATE POLICY "Users insert own expense entries" ON public.expense_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN (
      'hr_executive', 'super_admin', 'managing_director'
    )
  );

-- Fix SELECT policy: add accounts_executive for mark-paid flow
DROP POLICY IF EXISTS "Users see own expense entries" ON public.expense_entries;
CREATE POLICY "Users see own expense entries" ON public.expense_entries
  FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN (
      'super_admin', 'managing_director', 'finance_director', 'sales_director',
      'architecture_director', 'hr_executive', 'finance_manager', 'accounts_executive'
    )
    OR (
      status = 'pending_hod'
      AND public.get_user_role(auth.uid()) IN ('production_head', 'head_operations')
    )
  );

