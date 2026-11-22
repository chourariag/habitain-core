# PROJ-ACCESS — CONFIRM

## Migration and enforced route

- **0063** — `drizzle/migrations/0063_project_creator_access.sql`, applied through the managed migration tool; generated client types updated automatically.
- Private `project_creators`: plain auth-user UUID key, requested grant/revoke fields plus standard creation/update/archival attribution. RLS enabled; PUBLIC/anon/authenticated direct table access revoked; service role has full grants. No client policies. No grants seeded. Rows are never hard-deleted by the application; Remove records soft revocation.
- `can_create_project(uuid)`: STABLE SECURITY DEFINER, `search_path=public`, requires active non-archived profile plus Tier 1/Super membership from `user_roles` or an active explicit grant.
- `list_project_creators()`: STABLE SECURITY DEFINER. Returns built-in markers, safe names and role arrays, explicit active/revoked grants and attribution, and active candidate people. No email, phone or account credentials.
- `grant_project_creator(uuid,text)` and `revoke_project_creator(uuid)`: SECURITY DEFINER; caller internally checked as active Tier 1/Super. Target UUID never substitutes for the caller. Built-in users cannot be granted/revoked. Serialized per-target mutation and existing `super_admin_audit_log` insertion are one transaction. Each grant/revoke logs actor, target, timestamp and old/new state.
- `create_project(jsonb,text,text)`: SECURITY DEFINER, checks `can_create_project(auth.uid())`; fixed payload whitelist prevents callers setting creator, status, approval flags or portal fields. Existing location/contact validation and contractor acceptance checks retained. Generated `project_type` omitted from the insert. Returns only project ID, not contact.
- **All five public RPCs:** `search_path=public`, PUBLIC/anon execution revoked, authenticated execution granted. Execution does not mean entitlement: each writer/list checks the caller internally. No new edge function.
- Route **D: atomic SECURITY DEFINER RPC** selected because child INSERT policies do not admit arbitrary granted users. Initial ordinary modules, their eleven existing modular stage rows each, and panel-parent/panel rows commit or roll back together. Child policies were not widened. Existing initial names/stage defaults/count behavior retained. The panel-parent retains its prior no-stage-row behavior. Existing project task-template cloning still runs through the unchanged project trigger.
- Projects INSERT policy alone changed to `can_create_project(auth.uid())`. Its name remains `Allowed roles can create projects`. UPDATE and DELETE policy definitions were checked before and after and are unchanged.

## INSPECT — old effective policies

All current projects policies apply to authenticated clients:

| Command | Old policy and roles |
|---|---|
| INSERT | `Allowed roles can create projects`: profile mirror role in **super_admin, managing_director, finance_director, sales_director, architecture_director, head_operations, planning_engineer**; did not check profile active status in this clause. |
| UPDATE | `Allowed roles can update projects`: same seven profile roles, in both USING and WITH CHECK. **Unchanged.** |
| DELETE | `Allowed roles can delete projects`: **super_admin, managing_director, sales_director, architecture_director, finance_director**. **Unchanged.** No application deletion flow added. |

`NEW_PROJECT_ROLES` existed only in `Projects.tsx`: Planning Head, Planning Engineer, four Tier 1 directors, Super Admin. It controlled only button visibility, not the actual INSERT policy. The old dialog separately allowed Planning Head/directors/Super, with Planning Head going through approval. Both mismatches are removed from the new creation UI: authenticated caller's `can_create_project` result controls button and dialog, failing closed on errors.

### Child INSERT policies — preserved

- `modules` — Planning Engineer, Super Admin, MD, Finance Director, Sales Director, Architecture Director via `get_user_role`.
- `panels` — same six roles via `get_user_role`.
- `production_stages` — Super Admin, MD, Head Operations, Production Head, Factory Floor Supervisor, QC Inspector, Finance Director, Sales Director, Architecture Director via `get_user_role`.
- The policies differ from each other: even a Planning Engineer previously able to insert modules could be blocked from inserting stages. Arbitrary granted people remain unable to insert child rows directly; the narrow checked creation RPC initializes children atomically without granting broader production editing.

## Every project INSERT path found and status

1. **NewProjectDialog direct projects INSERT**, followed by separate child INSERTs and unchecked child errors: replaced by the one atomic `create_project` RPC. All active built-in people and explicitly granted active people create directly; no new approval request or approval notification is generated. The existing contact-free planner upload notification remains outside the RPC.
2. **NewProjectDialog Planning Head request path**: removed from the new creation flow. Ungranted Planning Head sees no creation button/dialog; granted Planning Head creates directly. Private contact remains separately supplied to the creation RPC, never added to approval payloads or exports.
3. **`src/lib/approval-actions.ts` create_project branch / Approvals page**: existing `approve_project_request` call remains. That privileged database writer now first checks the approver's creation entitlement, then retains the existing request authorization, separation-of-duties and copy/clear behavior. Legacy callers retain their old downstream child initialization path and policies; these were not expanded or silently reworked. A non-director approved requester is not automatically granted.
4. **`UserManagement.tsx` legacy create_project approval branch**: its direct projects INSERT remains protected by the new INSERT policy. Entitled approvers can still insert; unentitled ones cannot. It retains its legacy limited creation/decision behavior and is not the new atomic workflow. No pending request was actioned.
5. **`approve_project_request(uuid)` SQL function**: the only existing live SQL routine found inserting projects. Creation entitlement guard added before its existing approval checks; no requests modified. Existing active directors/Super retain creation entitlement; a principal-only ADS approver now additionally needs an explicit grant. Existing Karan account also has Architecture Director and remains entitled.
6. **`raise_project_request(jsonb,text,text)`**: creates staging/request rows, not projects. Its old Planning Head/Tier 1 permission check now uses `can_create_project`; this prevents ungranted users using an old endpoint. New UI never calls it. Its private staging behavior remains available only to entitled callers; no new request was raised.
7. **Contractor work-order flow**: uses the same NewProjectDialog, now the atomic RPC with unchanged signed Acceptance Statement requirement. Work-order helpers/WorkOrdersTab do not independently insert projects. No new work-order grants/policies.
8. **Edge functions**: no project INSERT path found. Project-reading/export/dispatch functions are unaffected.
9. **Historical migration SQL and test fixtures**: are not live client paths. Test project INSERTs are rollback-only. No source template import was changed.

## Pending requests and affected people

- Pending `create_project` requests: **0 before, 0 after**. None seeded, deleted, approved or modified.
- Active **Karthik — Planning Engineer** and **Venkat — Head Operations** lose direct project creation until explicitly granted. Their existing project UPDATE entitlement remains unchanged. No automatic grant was added.
- **Suraj Rao — Planning Head** previously had the dialog's approval-request path; now also needs an explicit grant to create. No account or role changed.
- Built-in principals remain automatically entitled only while their profile is active/non-archived. Explicit grants do not let inactive accounts create. The built-in group is shown read-only; people/roles are database-derived, not hardcoded names.

## UI and audit

- New **Project Creators** tab on Super Admin, visible through its existing Tier 1/Super page gate and with its own Tier 1/Super component guard.
- Built-in people displayed read-only beneath **Always allowed (Super Admin, MD, Directors)**. Explicit rows show person, roles, granting actor/date, note and current/revoked state. Remove invokes the checked soft-revoke RPC.
- Add person dialog searches active candidates by name or role; built-in and currently granted people are not offered as candidates.
- Existing Super Admin page uses Tabs and existing UsersTab obtains account data through a checked reader. New tab follows the same design controls without changing UsersTab or Role Permissions. Tab strip uses the existing scroll wrapper to fit 360px.
- Existing Audit tab reads `super_admin_audit_log`; grant/revoke entries are written server-side to that same trail, not merely optimistic browser logging. Audit query refresh is invalidated after changes. No client contact values enter grant/create audit entries.

## Verification evidence

- **Live rollback tests:** all **31 active principals** checked. **5 built-in allowed**, **26 denied** before any temporary grant. Each allowed principal executed actual atomic creation within the rolled-back transaction; every denied principal failed direct project INSERT and creation RPC, list/grant/revoke, legacy approval/request bypass attempts, and direct private-table read/write.
- Existing active Site Engineer temporarily granted inside the rollback test: helper became true; actual RPC created **2 ordinary modules + 1 panel-parent = 3 modules**, **22 stage rows**, **3 panels**. Project actor IDs and contact normalization confirmed. Granted creator could not read private contact or directly insert a module. Direct project INSERT worked under the scoped policy. Soft revocation restored both direct/RPC denial and retained the grant row plus two audit events, all rolled back.
- Separate rollback matrix: each of the **five built-in principals** could list, grant and revoke; inactive principal denied; direct UPDATE/DELETE of creator table denied. Built-in target grant/revoke rejected. No account/role changes used for tests.
- Anonymous helper, direct INSERT and creation RPC calls denied. All private-table grants and RPC grants inspected live. No authenticated/anon direct table grants or client policies.
- **`site_installation_mgr` has no active account:** automatic screen-role cases only; not represented as a live database principal. Other explicitly requested roles have active accounts and were covered in the live matrix. Principal Architect is not a built-in role, but its existing dual-role Architecture Director account is entitled.
- Added **24 access UI tests** and one additional denied-dialog regression; updated two existing creation tests for the atomic/no-approval behavior. The preserved rollback script lives at `src/test/project-access.rollback.sql`; executed checks used the managed query tool and rolled back.
- **Full suite: 876 passed, 0 failed, 0 skipped, 63 files**, `bunx vitest run --maxWorkers=2`. Both Phase 1 gate modes remain covered and unchanged.
- **Running Bill unchanged**, fresh authenticated read: earned **₹151,000**, own labour **₹6,365.46**, subcontract **₹0**, excess **₹19,500**; factory labour ₹0.
- Real signed-in MD browser: Project Creators loaded built-in people and zero grants, search by “planning engineer” found Karthik, Projects showed New Project, dialog showed **Create Project**, no Send for Approval. Desktop **1280×1800** and mobile **360×800** checked; document width **360**, viewport width **360**, no horizontal overflow; screenshots inspected. No runtime errors; automatic preview **build OK**.
- Real browser did not submit Add/Remove/Create, so no grant was seeded or persistent test project created. Grant/remove UI readback and creation input were verified with automated component tests; database write outcomes were verified transactionally. A persistent browser creation/grant flow is **not claimed**.
- Final state: **0 explicit grant rows**, **0 Project Creators audit rows from tests**, **6 existing projects**, **0 pending create requests**, **reminder_events 0**. No feature value, cron/schedule/reminder, account/role, pre-production, Setup, Running Bill, Rates, Cost, Daily/Factory report changes or “Fix all”.

## Release

**Publish > Update** to release the new page/button/dialog changes. The server permission migration is already applied to the shared backend.