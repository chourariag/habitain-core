
-- Restrict tally_api_keys SELECT to super_admin + managing_director only
DROP POLICY IF EXISTS "Viewers can read key metadata" ON public.tally_api_keys;

CREATE POLICY "Admins can read key metadata"
  ON public.tally_api_keys
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'managing_director')
  );
