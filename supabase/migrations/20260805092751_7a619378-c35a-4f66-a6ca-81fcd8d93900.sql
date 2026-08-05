-- Add slack_user_id to profiles for Slack integration notifications.
-- This column already exists in the live database; the IF NOT EXISTS guard
-- makes the migration safe to run against both fresh and existing environments.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

COMMENT ON COLUMN public.profiles.slack_user_id IS 'Slack member ID used for direct Slack notifications.';
