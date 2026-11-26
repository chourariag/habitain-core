# SCHED-2a-fix — CONFIRM

## Result

Azad Ali is now a named schedule editor. Migration `0073_sched2a_named_editor_seeds.sql` contains idempotent email lookups for both Venkat and Azad, so rebuilding from the repository restores exactly these two named editors. No earlier migration was edited.

No other user was added. `schedule_editor_roles` was not changed. No other application table, screen, feature flag, cron job or account was changed. Database only; no Publish is needed.

## 1. Azad's authoritative account

Lookup used `user_roles.user_id = profiles.auth_user_id`, with `auth.users.id = profiles.auth_user_id` for the authoritative email. The profile's full-name field is `display_name`.

- Matching active accounts: **1**
- Name: **Azad Ali**
- Auth user id: **`822687f1-c516-4ddc-b54f-f574acd32859`**
- Email: **`prod.dbr3@altree.in`**
- Role: **`production_head`**
- Active: **true**
- Named-editor note: **`Head of Execution (Azad Ali)`**

Because exactly one active match existed, his row was added. No candidate was guessed or substituted.

## 2. Repository-restorable seeds

Applied file: `drizzle/migrations/0073_sched2a_named_editor_seeds.sql`.

```sql
INSERT INTO public.schedule_editor_users (user_id, note)
SELECT au.id,
  CASE au.email
    WHEN 'designblr3@altree.in' THEN 'Head of design team (Venkat)'
    WHEN 'prod.dbr3@altree.in' THEN 'Head of Execution (Azad Ali)'
  END
FROM auth.users au
WHERE au.email IN ('designblr3@altree.in', 'prod.dbr3@altree.in')
ON CONFLICT (user_id) DO NOTHING;
```

The primary-key conflict target makes repeated application idempotent. Existing notes are not overwritten.

## 3. Exact named-editor SELECT and result

```sql
SELECT su.user_id, au.email, su.note
FROM public.schedule_editor_users su
JOIN auth.users au ON au.id = su.user_id
ORDER BY au.email;
```

| user_id | email | note |
|---|---|---|
| `e7554a18-8a12-4f45-b81d-468426c64f8b` | `designblr3@altree.in` | `Head of design team (Venkat)` |
| `822687f1-c516-4ddc-b54f-f574acd32859` | `prod.dbr3@altree.in` | `Head of Execution (Azad Ali)` |

Total: **exactly 2 rows**.

`schedule_editor_roles` remains exactly:

- `head_of_projects`
- `managing_director`
- `planning_engineer`
- `planning_head`
- `super_admin`

Neither `head_operations` nor `production_head` was added.

## 4. Real-account rollback verification

Evidence script: `src/test/sched2a-fix-named-editors.rollback.sql`.

Test project: `e4f51cd6-fb25-475e-980a-5e46070d678f`, with no published baseline. Project memberships needed for the checks were inserted only inside the transaction.

1. **Azad, as his real auth account:** `can_edit_schedule(auth.uid())` returned true. He successfully ran `schedule_recalculate_dates(project_id)` himself. The function returned `count: 187`, and an audit row with `actor_id = Azad` and `action = 'recalculate_dates'` existed inside the transaction. The returned warnings report the project's existing tasks without units/Day 1; no calendar logic was changed.
2. **Another real active account with `head_operations`:** the live database has no other persistent `head_operations` account besides Venkat, who is intentionally a named editor. Therefore Vincent (`prod.dbr5@altree.in`, active auth user `47f183de-2809-4c9d-91b0-ab323ff3d0ad`) was given `head_operations` only inside this rollback transaction. With that role present, `can_edit_schedule` returned false and `schedule_recalculate_dates` was rejected with SQLSTATE **42501**.
3. The deliberate final `P0001` evidence exception rolled back every test membership, temporary role, task/date update and audit row.

Post-rollback readback:

- Named editors: **2**
- Residual temporary `head_operations` role for Vincent: **0**
- Residual `sched2a_fix_test` memberships: **0**
- Residual Azad recalculation audit rows from the test: **0**

No account or role fixture persisted. The only persistent data change is Azad's requested named-editor row plus the repository migration containing both requested seeds.

## 5. Automated tests and scope

- **66 test files passed**
- **955 tests passed**
- **0 failed, 0 skipped**
- No frontend files or application screens were changed.
- No Publish > Update is needed.
