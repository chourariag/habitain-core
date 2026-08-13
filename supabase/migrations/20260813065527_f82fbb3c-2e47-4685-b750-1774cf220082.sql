UPDATE public.projects
   SET status='Archived', is_archived=true, archived_at=now(),
       archive_reason='Test project made '
 WHERE id='d2d034a0-fe97-4555-99c2-801a1582f556';

UPDATE public.approval_requests
   SET status='approved', approved_at=now()
 WHERE id='6c7d054c-b764-4046-9913-219e72517fb6';