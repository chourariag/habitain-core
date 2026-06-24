-- Re-assert column-level revokes (idempotent) to make intent explicit for the scanner
REVOKE SELECT (email, phone, date_of_birth, wedding_anniversary, children) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (client_email, client_phone, client_portal_token) ON public.projects FROM authenticated, anon;

-- Harden hr-docs storage SELECT policy: bind to ownership via hr_documents / payslips rather than folder-name string match
DROP POLICY IF EXISTS "Employees read own hr-docs" ON storage.objects;
CREATE POLICY "Employees read own hr-docs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'hr-docs'
  AND (
    public.can_manage_hr_documents(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.hr_documents d
      WHERE d.pdf_url = storage.objects.name
        AND d.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.payslips p
      WHERE p.pdf_url = storage.objects.name
        AND p.user_id = auth.uid()
    )
  )
);