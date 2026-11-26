INSERT INTO public.schedule_editor_users (user_id, note)
SELECT au.id,
  CASE au.email
    WHEN 'designblr3@altree.in' THEN 'Head of design team (Venkat)'
    WHEN 'prod.dbr3@altree.in' THEN 'Head of Execution (Azad Ali)'
  END
FROM auth.users au
WHERE au.email IN ('designblr3@altree.in', 'prod.dbr3@altree.in')
ON CONFLICT (user_id) DO NOTHING;