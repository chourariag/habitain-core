# Role Permissions Matrix — Implementation Plan

## Scope
Add a Super Admin tab "Role Permissions" — a spreadsheet-style matrix (rows = pages/tabs, columns = roles, cells = permission level). UI visibility only; RLS untouched.

## 1. Database (migration)

New table `role_permissions`:
- `id uuid pk`
- `role_code text not null`
- `page_key text not null`
- `permission_level text not null check in ('full','view','hidden','locked')`
- `updated_by uuid`, `updated_at timestamptz default now()`
- unique (`role_code`, `page_key`)

New table `role_permissions_audit`:
- `id`, `role_code`, `page_key`, `old_value`, `new_value`, `changed_by`, `changed_at`

RLS:
- `role_permissions` SELECT: authenticated (every page needs to read its own row)
- `role_permissions` INSERT/UPDATE/DELETE: only `is_md(auth.uid())`
- Audit table: SELECT for MD only, INSERT via trigger (security definer)
- Trigger writes audit row on every change

## 2. Page-key catalogue (constants)

`src/lib/role-permissions-catalog.ts` — exports:
- `PAGE_GROUPS`: `[{ section, pages: [{ key, label }] }]` covering every row from the spec (Dashboard, Approvals, Projects, Production, On Site, Procurement, Finance, Design, Sales, Altree HR/Admin/Super Admin/Settings).
- `PERMISSION_ROLES`: 25 role codes from the column spec.
- `PERMISSION_LEVELS`: `full | view | hidden | locked` with colour + icon.
- `DEFAULT_MATRIX`: function that returns the per-role-per-page default level based on the rules block in the request (MD/super_admin/director always full; locked rules per role; everything unspecified = hidden).

## 3. Matrix UI

`src/components/super-admin/RolePermissionsTab.tsx`:
- Toolbar: search box (filter pages), role multi-select, "Reset to Defaults" (MD only, confirm dialog), "Export Matrix" (xlsx).
- Sticky-header sticky-first-column table.
- Rows grouped by section with bold group header.
- Cells: coloured background + dropdown (Full / View / Hidden / Locked). MD + super_admin columns rendered locked with padlock and disabled select.
- Auto-save on change → upsert + toast `Permission updated: {role} — {page} → {level}`.
- Audit log: collapsible `<details>` at bottom, last 100 entries.

## 4. Hook for runtime gating

`src/hooks/useRolePermissions.ts`:
- Loads all permissions for the current role into a `Map<page_key, level>`.
- Exports `usePagePermission(pageKey)` → `'full' | 'view' | 'hidden' | 'locked'` (defaults to `'hidden'` when no row).
- MD + super_admin short-circuit to `'full'` without DB call.

Note: rule #3 ("overrides all hardcoded role checks") is a one-line note in the hook's JSDoc — actual gating is opt-in per page via the hook. We do not rip out existing role logic in this change.

## 5. Wire into Super Admin page

Add tab in `src/pages/SuperAdmin.tsx`: `"Role Permissions"` between Roles & Access and Escalation, using `<Shield />` icon.

## 6. Seed defaults

On first load: if `role_permissions` is empty, the matrix renders defaults from `DEFAULT_MATRIX` (in-memory). The first edit to any cell triggers a one-time "Initialize defaults" upsert of the full matrix.

## What is NOT in scope
- Refactoring existing pages to call `usePagePermission` — that is a separate phased migration.
- Changing any RLS policy.
- Per-row data scoping (e.g. "sales_executive own deals only") — that is data-level, not UI-level.

## Files
- `supabase/migrations/<ts>_role_permissions.sql` (new)
- `src/lib/role-permissions-catalog.ts` (new)
- `src/hooks/useRolePermissions.ts` (new)
- `src/components/super-admin/RolePermissionsTab.tsx` (new)
- `src/pages/SuperAdmin.tsx` (edit — add tab)
