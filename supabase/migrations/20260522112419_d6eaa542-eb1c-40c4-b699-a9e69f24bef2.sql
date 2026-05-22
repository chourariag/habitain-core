
-- Add FKs to auth.users(id) for columns that store auth user IDs.
-- Idempotent: drop if exists before re-adding.

DO $$
DECLARE
  rec record;
  fks text[][] := ARRAY[
    ['attendance_records','user_id','fk_attendance_records_user_id','RESTRICT'],
    ['amc_contracts','created_by','fk_amc_contracts_created_by','SET NULL'],
    ['admin_audit_log','performed_by','fk_admin_audit_log_performed_by','SET NULL'],
    ['design_queries','raised_by','fk_design_queries_raised_by','SET NULL'],
    ['notifications','recipient_id','fk_notifications_recipient_id','CASCADE'],
    ['app_settings','updated_by','fk_app_settings_updated_by','SET NULL'],
    ['announcements','posted_by','fk_announcements_posted_by','SET NULL'],
    ['attendance_exports','generated_by','fk_attendance_exports_generated_by','SET NULL']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(fks,1) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', fks[i][1], fks[i][3]);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
      fks[i][1], fks[i][3], fks[i][2], fks[i][4]
    );
  END LOOP;
END $$;
