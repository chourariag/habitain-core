-- Add onboarding columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_quiz_scores jsonb;

-- Weekly habit tracking table
CREATE TABLE public.weekly_habit_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  login_days integer NOT NULL DEFAULT 0,
  daily_logs_completed integer NOT NULL DEFAULT 0,
  daily_logs_expected integer NOT NULL DEFAULT 0,
  gps_checkins integer NOT NULL DEFAULT 0,
  feature_usage_score integer NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

ALTER TABLE public.weekly_habit_tracking ENABLE ROW LEVEL SECURITY;

-- Users see own data
CREATE POLICY "users_own_habits" ON public.weekly_habit_tracking
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- HODs see all (they filter in app by team)
CREATE POLICY "hods_view_habits" ON public.weekly_habit_tracking
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'production_head') OR
    public.has_role(auth.uid(), 'head_operations') OR
    public.has_role(auth.uid(), 'finance_manager') OR
    public.has_role(auth.uid(), 'site_installation_mgr') OR
    public.is_director(auth.uid())
  );

-- Insert policy for system/edge functions
CREATE POLICY "system_insert_habits" ON public.weekly_habit_tracking
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1) OR
    public.is_full_admin(auth.uid())
  );