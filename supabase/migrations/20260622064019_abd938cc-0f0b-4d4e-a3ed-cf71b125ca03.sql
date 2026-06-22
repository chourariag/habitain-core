UPDATE auth.users
SET encrypted_password = crypt('Altree@1234', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email LIKE '%@altree.in'
   OR email = 'arun@surinauto.com';