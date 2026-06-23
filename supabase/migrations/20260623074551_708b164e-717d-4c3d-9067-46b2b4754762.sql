DROP POLICY IF EXISTS "System can insert weekly_digests" ON public.weekly_digests;
CREATE POLICY "Admins can insert weekly_digests"
ON public.weekly_digests
FOR INSERT
TO authenticated
WITH CHECK (public.is_full_admin(auth.uid()));