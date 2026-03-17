
-- Fix projects INSERT policy to include managing_director and planning_engineer
DROP POLICY IF EXISTS "Management can create projects" ON projects;
CREATE POLICY "Management can create projects" ON projects FOR INSERT TO authenticated
WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY[
    'managing_director'::app_role,
    'finance_director'::app_role,
    'sales_director'::app_role,
    'architecture_director'::app_role,
    'head_operations'::app_role,
    'production_head'::app_role,
    'planning_engineer'::app_role
  ])
);

-- Fix projects UPDATE policy to include managing_director and planning_engineer
DROP POLICY IF EXISTS "Management can update projects" ON projects;
CREATE POLICY "Management can update projects" ON projects FOR UPDATE TO authenticated
USING (
  get_user_role(auth.uid()) = ANY (ARRAY[
    'managing_director'::app_role,
    'finance_director'::app_role,
    'sales_director'::app_role,
    'architecture_director'::app_role,
    'head_operations'::app_role,
    'production_head'::app_role,
    'planning_engineer'::app_role
  ])
);

-- Add kiosk_pin column to profiles for PIN-based kiosk login
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kiosk_pin text;
