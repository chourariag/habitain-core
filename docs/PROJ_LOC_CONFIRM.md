# HSTACK — PROJ-LOC CONFIRM

## Delivery and verification

- Applied migrations **0058–0062**. No existing project values were changed. Project count remained **6**; private contact requests **0** after rollback tests; `reminder_events` **0 → 0**.
- Full suite: **805 passed, 0 failed, 0 skipped, 59 files**. Includes **92 new tests** covering validation, contact readers/editors, project creation, check-in and export privacy. A first parallel run had a test-mock state issue and a resource-related timeout; both were resolved before the final successful run.
- Signed-in 360 × 800 browser checks: Projects page, New Project dialog and project detail all had **no horizontal overflow**. Pasted Google Maps coordinates resolved to **12.9716, 77.5946**, with default radius **300**. Desktop project detail was also checked at 1280 × 1800. Test form was cancelled rather than saving a production project.
- Creation and edit handlers were exercised with real form input in rendered tests; database approval, contact readback, edits and attendance enforcement were separately exercised in rolled-back transactions. A persistent browser-created project/approval was deliberately not performed, to preserve existing data and avoid test notifications.
- Automatic preview build: **OK**. Existing `generate-project-archive` was deployed with contact stripping; no archive was generated during testing and no storage data was changed.

## INSPECT findings

### Creation paths and columns

- Before the change, `NewProjectDialog.tsx` collected neither site location nor phone/email. Direct Tier 1/Super creation inserted core project fields at original lines **169–175**, followed by the existing module, stage and panel creation at **180–217**. The comment said MD/Super, but its actual gate already included all four Tier 1 directors.
- Planning Head used `raiseApprovalRequest` at original lines **127–128**. That helper directly inserted the supplied payload into `approval_requests` (`src/lib/approval-requests.ts:33–43`). `approval-actions.ts` originally spread the payload into a project at **57–65** before creating modules/panels at **69–99**.
- All six requested columns already existed: `location` text, `site_lat`/`site_lng` numeric, `site_radius` integer, `client_phone`/`client_email` text. No new project columns or backfill were needed.
- Contrary to the intended private-column arrangement, inspection found an authenticated **table-level SELECT grant** on `projects`, which overrode the absence of individual contact-column grants. This was removed, preserving authenticated SELECT on all non-private project columns. Phone/email and the existing private portal token have no direct client SELECT. Existing project RLS policies were not changed.
- Project RLS allowed active staff reads and existing profile-based creation/update roles. These policies remain unchanged. Existing location/contact columns were not in the active Setup upload code inspected; Setup upload was not modified.
- `project_type` is a generated column derived from division. The approval writer preserves database generation rather than inserting a value; direct New Project creation also omits that generated field. The Work Order link and unit reference remain captured.

### Old contact access and every caller

The old `get_project_client_contact` combined `is_director(auth.uid())` with this explicit list:

`super_admin`, `managing_director`, `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `finance_manager`, `accounts_executive`, `principal_architect`, `project_architect`, `site_installation_mgr`, `sales_executive`, `sales_associate`, `marketing`.

- **ProjectDetail** was the only pre-existing direct RPC caller (`src/pages/ProjectDetail.tsx`, original line **101**, now **104**). Its phone/email rows originally rendered at **196–204**. These now render only when returned and the displayed role is Tier 1/Super.
- **HandoverPack** was not an RPC caller; it used a wildcard project read (original line **74**) and `project.client_email` for its mail action at **184–190**, conditionally shown at **225–229**. It now uses safe project fields plus the narrowed contact RPC. Non-directors cannot obtain the project's private email for that action; directors retain it.
- **ClientPortalManager** never called this contact RPC. It uses `get_project_client_portal_token` and separately entered `client_portal_tokens.client_email` (`:157`, `:181`). It does not receive or copy the New Project contact, and its separate workflow remains unchanged.
- **ProjectArchive** and **Projects** used wildcard project reads; both now use an explicit public projection without contact.
- The existing archive-generating function serialized a wildcard project record into `project-summary.json`. New archive output now strips phone, email and portal credentials before serialization. Existing archives were not regenerated or altered.
- `ai-agents/index.ts:457` selects project email server-side, but its subsequent client-approval reminders use client/project names, not the email; no phone/email is sent. The function was not changed or run.
- The legacy `get_project_by_client_portal_token` reader returns the **separately entered token email**, not `projects.client_email`. Its original behaviour was preserved after inspection; no New Project contact is copied there.
- No other runtime caller of `get_project_client_contact` was found. Generated types and tests are not application callers.

The nine formerly allowed **non-director roles** lose project contact readback: `head_operations`, `finance_manager`, `accounts_executive`, `principal_architect`, `project_architect`, `site_installation_mgr`, `sales_executive`, `sales_associate`, `marketing`. They lose the ProjectDetail contact rows and any direct project-column retrieval; Handover's project-email action is unavailable to them. Other operational screens and separately entered portal-token contacts remain unchanged.

### Attendance before missing-pin enforcement

- Employee check-in: `CheckInButton.tsx`, original **169–183**, treated missing site coordinates as GPS verification disabled, captured the employee's current GPS and allowed a manual check-in. `MIN_RADIUS_METERS` was and remains **300** (original **89**, now **91**); effective employee radius still uses `max(stored radius, 300)`.
- `save_labour_attendance` previously checked role/project access, dates, toolbox photo/exception and hours, but did **not** require a site pin. A report could be entered without coordinates if its other gates passed.
- `add_attendance_photo` required live GPS, but skipped its distance calculation when either project coordinate was NULL. Photos then lacked a far-from-site flag. Its configured radius/default, distance warnings and low-accuracy rules remain unchanged.
- Labour screen previously required GPS through the live toolbox camera but did not check that the project's reference pin existed. It now displays the requested message and blocks capture/save until set.
- The diary AI GPS check (`supabase/functions/ai-agents/index.ts:534–565`) only compares distance when both diary GPS and truthy project coordinates exist. Missing coordinates skip that check and end with “Site diary verified — no issues”. This diary/report function was **not changed**, as requested.

## Chosen private approval design

- `project_client_contact_requests` stores request ID, normalised phone and email privately, with audit metadata. RLS is enabled, no client policies, and **no anon/authenticated direct grants**. Service role retains full grants.
- A requester must be able to **write** contact without being able to read it. Therefore `raise_project_request` permits the existing Planning Head creation path as well as Tier 1/Super; its separate contact **read** RPC remains Tier 1/Super-only. Restricting the write RPC to directors would make the requested non-director creation path impossible.
- The RPC atomically writes a whitelisted contact-free approval payload and private staging. No separate partially saved request/contact step exists.
- Approval uses unchanged `can_approve_request` and one transaction: lock the pending request, reject self/double approval, create the project with staged contact, approve the request, clear phone/email, and archive the staging metadata. “Temporary store empty” means no active staging rows or retained contact values; metadata is retained rather than hard-deleted.
- A create-project payload trigger rejects phone/email keys, including nested keys, even through the legacy direct approval-table path. Other request types are unaffected.
- Contact changes are audited with actor, time, action and changed field names **only**, never old/new contact values. Location edits record old/new address, pin and radius.

## Functions and grants

| Function | Internal caller check | Client execution |
|---|---|---|
| `get_project_client_contact(uuid)` | `is_tier1_or_super(auth.uid())` | authenticated; PUBLIC/anon revoked |
| `get_project_request_client_contact(uuid)` | `is_tier1_or_super(auth.uid())` | authenticated; PUBLIC/anon revoked |
| `raise_project_request(jsonb,text,text)` | Tier 1/Super or Planning Head in `user_roles` | authenticated; PUBLIC/anon revoked |
| `approve_project_request(uuid)` | unchanged `can_approve_request`, pending, not self | authenticated; PUBLIC/anon revoked |
| `set_project_client_contact(uuid,text,text)` | Tier 1/Super | authenticated; PUBLIC/anon revoked |
| `set_project_site_location(uuid,text,numeric,numeric,integer)` | Tier 1/Super or Head of Projects | authenticated; PUBLIC/anon revoked |

All six are SECURITY DEFINER with `search_path=public`; readers are STABLE. Unauthorised authenticated contact readers receive no row (the UI treats it as NULL); anonymous execution is denied by grants. Internal validation and attendance helpers/trigger functions have PUBLIC/anon/authenticated execution revoked. `project_location_contact_log` is likewise private, with RLS and no client grants/policies.

Migrations:

- **0058**: private staging/audit, checked readers/writers/approval, safe project grants, missing-pin attendance checks.
- **0059**: explicitly revoke inherited grants on new private tables; creation validation and project-linked metadata-only audits.
- **0060**: preserve the independently entered portal-token email behaviour after confirming it is not project contact.
- **0061**: preserve the generated project type in approval inserts.
- **0062**: contact-free create-project payload guard, including legacy direct inserts.

## Tests and concrete evidence

### Live account matrix

**31 existing active principals** tested against a populated rolled-back project:

- Contact read/edit: **5 allowed, 26 denied**.
- Site-location edit: **6 allowed, 25 denied**.
- All principals denied direct contact-column SELECT. Anonymous RPC execution denied.

Allowed contact roles: `managing_director`, `finance_director`, `sales_director`, `architecture_director`, `super_admin`. Location additionally allows `head_of_projects`.

Live denied account roles included `accounts_executive`, `assistant_manager`, `chairman`, `costing_engineer`, `electrical_installer`, `factory_supervisor`, `finance_manager`, `head_operations`, `hr_admin`, `hr_executive`, `logistics_manager`, `marketing`, `planning_engineer`, `planning_head`, `production_head`, `project_architect`, `purchase_assistant`, `qc_inspector`, `sales_associate`, `sales_executive`, `senior_architect`, `site_engineer`, `stores_executive`. Head of Projects was denied contact but allowed location edits.

- **site_installation_mgr** has no active account: rendered UI/pure role tests only, no live principal test.
- The active **principal_architect** account also has **architecture_director**. It correctly retained director access and approved the rolled-back ADS request. A principal-only non-director approver account was unavailable; principal-only contact denial was tested in rendered UI. The non-director pending read denial was live-tested with Head of Projects and the Planning Head requester. No accounts or roles were created or altered for testing.

### Approval/privacy

Live rollback assertions passed: Planning Head request payload has neither contact key/value; requester and non-director reader cannot retrieve staging; director retrieves normalised contact; approval copies it onto the project and clears/archives staging; second approval is rejected; project/request audit and notification rows contain neither submitted value. No test notifications were sent or persisted.

Nightly project manifest remains unchanged and excludes phone/email. Tests assert safe project-list columns and archive removal using concrete private values. No new contact is copied into token records or exports.

### Validation and attendance

- Phone: `9876543210` and `+91 98765 43210` normalise to `+919876543210`; wrong length/country prefix and invalid Indian mobile prefixes fail.
- Email: valid dotted-domain email passes; missing parts, spaces, repeated `@`, and invalid domains fail.
- Coordinates: ranges ±90/±180 accepted, out-of-range/nonfinite/missing/0,0 rejected. Outside-India coordinates warn without blocking. Plain pairs and full Maps query/@/place links parsed; ambiguous shortened links require opening in Maps and copying a full coordinate-bearing link.
- Radius: default **300**; **50, 300, 1000** accepted; **49, 1001, 50.5, −1** rejected. Existing employee effective minimum of 300 and existing out-of-zone note/low-accuracy exceptions are deliberately preserved, not silently changed by the new form.
- Missing pin: employee insert, labour save and toolbox photo RPC all rejected with **“Site location is not set. Ask a director or the Head of Projects to set it.”** Rendered check-in test confirmed no GPS call or attendance insert for that state.
- Configured pass: pin/user **12.9716, 77.5946**, radius **300**, accuracy **10 m** → distance **0 m**, verified employee check-in; toolbox photo has no far flag.
- Configured fail: user/photo **13.0716, 77.5946** → distance about **11,119 m**, verification false, photo far-from-site warning. Employee confirmation remains disabled without a 10-character note; the existing off-site-note exception still records `gps_verified=false` after a valid note. This preserves prior behaviour.
- Original no-photo attendance gate and empty-row result were verified unchanged on a configured site.

### Regression

Live unchanged Test project Running Bill: **earned ₹1,51,000; own labour ₹6,365.46; subcontract ₹0; excess ₹19,500**.

Rendered MD creation regression confirmed **2 ordinary modules**, production-stage rows and **3 panels** beneath the existing Panel Production parent, with normalised contact only in the project insert. Planning Head creation uses the private request RPC and never directly inserts a project.

## Scope retained

No feature flags, cron/schedules, reminder jobs, roles/accounts, existing-table RLS policies, storage configuration, Setup upload, BOQ, Running Bill, Daily Report, factory report, Rates or Cost report changes. No new edge functions. No writes to `reminder_events`, real emails or DMs. Existing projects and existing archive files were not changed.

**Publish > Update** to release the project screens.