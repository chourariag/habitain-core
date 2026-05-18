-- === 20260325182939_0db905df-ef26-4e53-b179-7b15796e9ede.sql ===

-- Add missing columns to notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS navigate_to text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_table text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_id uuid;

-- Backfill title/body/category from existing columns
UPDATE public.notifications SET
  title = COALESCE(title, type),
  body = COALESCE(body, content),
  category = COALESCE(category, 'system'),
  related_table = COALESCE(related_table, linked_entity_type),
  related_id = COALESCE(related_id, linked_entity_id);

-- Set NOT NULL after backfill
ALTER TABLE public.notifications ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN body SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN category SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;

-- Add indexes if not exist
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_feed ON public.notifications (recipient_id, created_at DESC);

-- Enable RLS (idempotent)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist and recreate
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
END $$;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "System insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- === 20260325183659_29f93f73-8985-429e-8d2f-f7d6fdbf5e07.sql ===

-- Add columns to design_stages for GFC evidence tracking
ALTER TABLE public.design_stages ADD COLUMN IF NOT EXISTS evidence_url text;
ALTER TABLE public.design_stages ADD COLUMN IF NOT EXISTS evidence_uploaded_at timestamptz;
ALTER TABLE public.design_stages ADD COLUMN IF NOT EXISTS ticked_by uuid;
ALTER TABLE public.design_stages ADD COLUMN IF NOT EXISTS ticked_at timestamptz;

-- Add columns to project_design_files for target GFC and design-only flag
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS target_gfc_date date;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS is_design_only boolean NOT NULL DEFAULT true;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS linked_project_id uuid;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS gfc_issued_at timestamptz;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS gfc_issued_by uuid;
ALTER TABLE public.project_design_files ADD COLUMN IF NOT EXISTS gfc_issuer_name text;

-- Add columns to drawings for approval workflow
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS drawing_title text;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_review';
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_method text;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_date date;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_reference text;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approval_screenshot_url text;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS approved_by_name text;

-- === 20260325185606_ecee79b0-74a2-4645-9c17-f3c60935774b.sql ===

-- Create design_qc_checklist table
CREATE TABLE public.design_qc_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  section_number integer NOT NULL,
  section_name text NOT NULL,
  item_index integer NOT NULL,
  item_text text NOT NULL,
  is_ticked boolean NOT NULL DEFAULT false,
  ticked_by uuid,
  ticked_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, section_number, item_index)
);

-- Create design_detail_library table
CREATE TABLE public.design_detail_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  detail_number integer NOT NULL,
  detail_name text NOT NULL,
  status text NOT NULL DEFAULT 'Not Started',
  drawing_reference text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, detail_number)
);

-- Indexes
CREATE INDEX idx_design_qc_checklist_project ON public.design_qc_checklist (project_id);
CREATE INDEX idx_design_detail_library_project ON public.design_detail_library (project_id);

-- RLS on design_qc_checklist
ALTER TABLE public.design_qc_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Architects and directors can view design_qc_checklist"
  ON public.design_qc_checklist FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect', 'structural_architect',
      'super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director'
    )
  );

CREATE POLICY "Architects can update design_qc_checklist"
  ON public.design_qc_checklist FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect',
      'super_admin', 'managing_director'
    )
  );

CREATE POLICY "Architects can insert design_qc_checklist"
  ON public.design_qc_checklist FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect',
      'super_admin', 'managing_director'
    )
  );

-- RLS on design_detail_library
ALTER TABLE public.design_detail_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Architects and directors can view design_detail_library"
  ON public.design_detail_library FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect', 'structural_architect',
      'super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director'
    )
  );

CREATE POLICY "Architects can update design_detail_library"
  ON public.design_detail_library FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect',
      'super_admin', 'managing_director'
    )
  );

CREATE POLICY "Architects can insert design_detail_library"
  ON public.design_detail_library FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN (
      'principal_architect', 'project_architect',
      'super_admin', 'managing_director'
    )
  );

-- === 20260326000001_rm_ai_analysis.sql ===
-- Add ai_analysis column to rm_tickets for storing AI-generated analysis reports
ALTER TABLE public.rm_tickets
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

-- === 20260330000001_delivery_checklist.sql ===
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

-- === 20260330000002_delivery_checklist_signer_names.sql ===
-- Add signer display name columns so sign-off banners can show name + role
ALTER TABLE public.delivery_checklists
  ADD COLUMN IF NOT EXISTS modules_signed_by_name    text,
  ADD COLUMN IF NOT EXISTS tools_signed_by_name      text,
  ADD COLUMN IF NOT EXISTS additional_signed_by_name text;

-- === 20260330000003_site_direct_receipts_grn_rls.sql ===
-- Add GRN reference number to site_direct_receipts for PO traceability
ALTER TABLE public.site_direct_receipts
  ADD COLUMN IF NOT EXISTS grn_id text;

-- UPDATE policy: stores/procurement can correct mis-logged receipts
CREATE POLICY "stores_procurement_update_site_receipts"
  ON public.site_direct_receipts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'procurement') OR
    public.is_full_admin(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'procurement') OR
    public.is_full_admin(auth.uid())
  );

-- DELETE policy: admin only
CREATE POLICY "admin_delete_site_receipts"
  ON public.site_direct_receipts FOR DELETE TO authenticated
  USING (public.is_full_admin(auth.uid()));

-- === 20260330104746_c8181226-fba9-4a9f-abad-0bdab7cb1be0.sql ===
-- Add delivery_destination column to inventory_items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS delivery_destination text NOT NULL DEFAULT 'factory',
  ADD COLUMN IF NOT EXISTS received_by_on_site text,
  ADD COLUMN IF NOT EXISTS site_receipt_notes text,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- Create site_direct_receipts table
CREATE TABLE IF NOT EXISTS public.site_direct_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  material_name text NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'units',
  vendor_name text,
  received_by_on_site text,
  site_receipt_notes text,
  category text DEFAULT 'General',
  received_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.site_direct_receipts ENABLE ROW LEVEL SECURITY;

-- RLS for site_direct_receipts
CREATE POLICY "stores_procurement_insert_site_receipts"
  ON public.site_direct_receipts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'procurement') OR
    public.is_full_admin(auth.uid())
  );

CREATE POLICY "stores_procurement_site_select_site_receipts"
  ON public.site_direct_receipts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'procurement') OR
    public.has_role(auth.uid(), 'site_installation_mgr') OR
    public.is_director(auth.uid())
  );

