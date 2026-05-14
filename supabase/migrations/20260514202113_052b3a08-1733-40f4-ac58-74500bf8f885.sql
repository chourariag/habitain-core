
-- 1. Remove dangerous anon UPDATE policy on variation_orders
DROP POLICY IF EXISTS "Anon can update variation orders" ON public.variation_orders;
DROP POLICY IF EXISTS "Anon can read variation orders" ON public.variation_orders;

-- 2. Tighten work_order_sequences (internal counter table)
DROP POLICY IF EXISTS "wo_seq_admin_all" ON public.work_order_sequences;
CREATE POLICY "wo_seq_admin_only"
  ON public.work_order_sequences
  FOR ALL
  TO authenticated
  USING (public.is_md(auth.uid()))
  WITH CHECK (public.is_md(auth.uid()));

-- 3. Revoke EXECUTE from anon on all SECURITY DEFINER functions in public.
-- Helper functions are only meant to be called from RLS contexts of signed-in users.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
                   rec.nspname, rec.proname, rec.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                   rec.nspname, rec.proname, rec.args);
  END LOOP;
END $$;
