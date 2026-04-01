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
