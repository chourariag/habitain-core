# Account security evidence — 0046

## Read-only inspection (original line numbers, credentials omitted)

- `src/components/super-admin/BulkCreateAccountsDialog.tsx:16`: retired-default constant; used at line 56.
- `src/pages/EmployeeManagement.tsx:34`: additional retired-default constant, reused for new employees, bulk seed and credential export fallbacks.
- `supabase/functions/admin-users/index.ts:611`: create-employee retired-default fallback.
- `supabase/migrations/20260622064019_abd938cc-0f0b-4d4e-a3ed-cf71b125ca03.sql:2` and `20260622070130_b701e8b6-baae-4292-a557-c19883b3a210.sql:3`: historical password-reset statements; now comments only.
- `admin-users` reset-password at original lines 755–757 used weak random generation, not the retired default. Its password minimum was eight characters; creation-with-password had no shared policy.
- `super-admin-create-user` used `Math.random` for credentials; no retired-default occurrence. `kiosk-login` used a PIN and returned a profile without Auth tokens; no password/default occurrence.
- Initial-admin access was unauthenticated; original callers were `Setup.tsx:22,54`, with a function entry in `supabase/config.toml`.
- Account access trusted `callerProfile.role`. `update_role` only upserted `user_roles` and retained old roles. `create_user`, existing-email employee linking, employee updates and offboarding role reassignment were additional role-changing paths inspected.
- No pre-existing mandatory-password-change field was present in the inspected profile schema.

## Migration and server changes

- Applied `drizzle/migrations/0046_retired_password_account_role_security.sql`.
- Added `profiles.must_change_password`, default false; one-time backfill flags every existing profile. Live readback: **32 of 32 flagged**.
- Added `guard_password_change_flag` and its profile trigger. Ordinary clients cannot clear the flag.
- Replaced `prevent_profile_role_escalation`; ordinary direct profile-role updates must use the checked account action.
- Added service-only `admin_set_account_access`, serialized by an advisory transaction lock; validates the active caller from `user_roles`, removes previous target role rows, inserts exactly one role, synchronizes `profiles.role`, and writes old/new/actor to `admin_audit_log` atomically.
- Last-admin checks use `get_sole_role_holders` plus active `user_roles` holders. No role or activation rows were changed by the migration.
- Deployed only the two authorized account functions. Removed the deployed initial-admin endpoint; live response **404**.
- The old migration files contain only `-- retired: shared default password removed`. Git history remains; this does not scrub prior commits.

## Final rules

- Trusted Super Admin may assign any role, including Super Admin.
- Managing, Finance, Sales and Architecture directors may assign every other role but cannot grant or revoke Super Admin.
- Nobody changes their own role, including Super Admin.
- The last active Super Admin cannot be demoted or deactivated. Existing deletion actions remain otherwise unchanged as requested; a Super Admin must first go through the checked demotion action before individual deletion, and bulk deletion skips Super Admin holders.
- Generated credentials use 24 cryptographic random bytes and exceed the requested 16-character minimum. Explicit credentials require at least ten characters and cannot match either inspected retired-default fingerprint.
- Passwords appear only in transient responses and screen state, with Copy and bulk CSV controls. Dismissal/unmount discards them; logs contain no passwords. Responses are non-cacheable.
- The existing invite-based admin creation path now creates an account with random credentials instead of sending email. No emails were sent during verification.
- The mandatory screen replaces protected content before any protected screen mounts. Sign-out remains available. Successful Auth password update must be followed by flag clearing and successful readback before access resumes. The flag is checked again on sign-in/session refresh.
- PIN kiosk users still use the unchanged tokenless kiosk path; the Auth-session gate does not intercept it.

## Verification

- **372 tests passed; 0 skipped; 41 test files.** Includes **49 account-security tests**: 26 policy/repository tests, 15 real-handler tests with isolated Auth/Data clients, and eight mandatory-screen tests.
- Handler tests assert MD Super Admin grant **403**, MD site-engineer grant success, Super Admin grant success, self-change denial, last-admin denial, and a single resulting role row. Database transaction/locking/audit statements are also checked; the migration applied successfully.
- Live signed-in existing-account checks: `/dashboard`, `/projects`, `/admin/users`, `/profile` each render only the mandatory-change screen, with zero navigation links.
- Live flagged account-management request: **403**. Live short-password request: **400**. Sign-out reaches `/login`.
- **360px** screenshot inspected; no horizontal overflow. Screenshot retained under `/tmp/browser/password-security/required-change-360.png` for this verification turn.
- Final exact-value repository scan: **src yes; supabase yes; drizzle yes**, zero retired-default occurrences in each. Zero source/config/migration references to the removed initial-admin endpoint.
- Latest automatic build: **OK**. `reminder_events`: **0**. No flag, schedule, reminder-rule, storage, report, attendance, Running Bill, export or other-function changes.
- No live account creation, password rotation, flag clearing, role change, email change, deletion or deactivation was executed; success-path account mutations were verified with isolated test clients to respect the restriction on real account changes. Real PIN-device login and real password-change completion were not exercised.

## Other password/account callers found

- `AddUserDialog`, `UsersTab` workbook upload, `BulkCreateAccountsDialog`, `CreateAccountsTab`, `EmployeeManagement` individual/bulk creation, and `UserManagement` approval creation.
- `UsersTab` previously sent admin reset emails; it now uses the checked random-password reset and one-time credential display.
- User-selected password paths: `Profile`, `ChangePasswordDialog`, `Welcome`, and `ResetPassword`; all share the checked password endpoint and policy. Existing login/forgot-password email requests are untouched and were not invoked.

## Changed-file inventory

- `AGENTS.md`, `roadmap.md`, and this evidence file.
- `drizzle/migrations/0046_retired_password_account_role_security.sql`, tool-generated `meta/0046_snapshot.json` and `meta/_journal.json`.
- Tool-generated `src/integrations/supabase/types.ts`.
- `src/components/AuthProvider.tsx`, `RequiredPasswordChange.tsx`, `ChangePasswordDialog.tsx`.
- `src/components/admin/AccountCredentials.tsx`, `AddUserDialog.tsx`.
- `src/components/super-admin/BulkCreateAccountsDialog.tsx`, `CreateAccountsTab.tsx`, `UsersTab.tsx`.
- `src/lib/admin-api.ts`, `password-policy.ts`, `change-password.ts`.
- `src/pages/EmployeeManagement.tsx`, `UserManagement.tsx`, `Profile.tsx`, `Welcome.tsx`, `ResetPassword.tsx`, `Setup.tsx`.
- `src/test/account-security.test.ts`, `admin-users-security.test.ts`, `required-password-change.test.tsx`.
- `supabase/functions/_shared/password-policy.ts`, `admin-users/index.ts`, `super-admin-create-user/index.ts`.
- Removed initial-admin function folder; removed its entry from `supabase/config.toml`.
- Neutralized the two historical `supabase/migrations/20260622064019_*` and `20260622070130_*` files.