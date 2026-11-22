# PROJ-LOC cleanup after PROJ-ACCESS

## Inspection and removal

- Live temporary store: **0 total rows / 0 active rows**. No existing project/contact/request data was changed.
- Database writers/readers found: `raise_project_request(jsonb,text,text)` wrote the request and staging; `get_project_request_client_contact(uuid)` read staging for directors; `approve_project_request(uuid)` copied and cleared staging. No other public function referenced the store.
- Frontend reader: `RequestClientContact` on the Approvals review dialog, plus its obsolete tests. No live frontend called the old request writer after PROJ-ACCESS. Historical migration SQL retains the previous definitions intentionally.
- Migration **0064** removes the old request writer and pending-contact reader. The Approvals pending-contact display/component is removed. Legacy project approval decisions retain their authorization, separation-of-duties, ownership, status and audit behavior, but no longer read/copy/clear staging.
- The platform blocks table deletion. `project_client_contact_requests` is therefore **kept empty and explicitly DEPRECATED**, with unchanged RLS, no direct client grants, and no remaining application functions reading/writing it. Its service-role grant is unchanged. Cleanup locks the store and aborts if any row exists, preventing a race with an old writer.

## Kept unchanged

- New Project already calls `create_project(jsonb,text,text)`, which writes validated phone/email directly to `projects` while atomically creating the initial children. No frontend direct INSERT was introduced; a granted creator would otherwise hit child policies. This existing creation path is unchanged.
- `get_project_client_contact(uuid)` remains Tier 1/Super only. `set_project_client_contact`, the site-location card/edit RPC, attendance checks and all creation/approval permissions are unchanged.
- Pending legacy requests and all existing contact values remain untouched. Contact-free approval payload validation and public/export projections remain in place.
- Roles/accounts, feature flags, schedules, reminders, Setup, Running Bill, Rates, Cost and Daily/Factory reports are unchanged.

## Evidence

- Live rollback-only check: temporarily grant an existing non-director Planning Head, create a project, confirm normalized contact is stored on projects, deny that creator both checked and direct contact reads, and verify director reads return the exact values. Initial children: **3 modules including panel parent / 22 stages / 3 panels**.
- Contact reader matrix checks all active principals against their server roles; anonymous execution is rejected. Built-in allowed roles: managing_director, finance_director, sales_director, architecture_director, super_admin. Non-directors receive no rows. `site_installation_mgr` has no active account; its deny case is covered by the pure-role test rather than a live account.
- Rollback check asserts no contact values in approval payloads, notifications or project creation audit rows across the existing audit tables; approval count is unchanged and retired staging remains empty. Frontend creation test captures actual notification arguments and verifies neither submitted contact value is included. Existing export/archive/list privacy tests pass.
- Full suite: **876 passed / 0 failed / 0 skipped, 63 files** (`bunx vitest run --maxWorkers=2`). Obsolete pending-contact tests were replaced with the unchanged director contact role matrix, not skipped.
- Running Bill readback: earned **₹151,000**, own labour **₹6,365.46**, subcontract **₹0**, excess **₹19,500**.
- Final readback: old staging RPCs absent, deprecated store **0 rows**, projects **6**, explicit creator grants **0**, pending create-project requests **0**, reminder events **0**. All test writes rolled back.
- Preview's latest build entry: **build OK**. No UI layout changes beyond removing the obsolete approval-contact section; no persistent browser project/grant creation was performed. Direct creation and contact readback were verified in a rolled-back server transaction, not a browser save.

Publish > Update for the Approvals display cleanup. The database cleanup is already applied.