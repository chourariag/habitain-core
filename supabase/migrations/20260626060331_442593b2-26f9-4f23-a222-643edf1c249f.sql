CREATE POLICY "Users can update own attendance"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());