# Today overview — CONFIRM

## Result

| Check | Result | Evidence |
| --- | --- | --- |
| Inspection and tab | PASS | Today is first in Site Hub. Existing `site_report` flag reused; no flag value changed. Existing assigned-role navigation records preserved. Production unchanged. |
| Reader security | PASS | Migration 0051: `get_site_overview(date)` and caller-bound `can_view_site_overview(uuid)`. Both STABLE, SECURITY DEFINER, `search_path=public`; EXECUTE revoked from PUBLIC/anon, granted to authenticated. Both anonymous calls denied. |
| Role and cost matrix | PASS | 31 existing active principals: 12 allowed, 19 denied. Assigned roles are combined; other-user helper arguments rejected. Site access uses `user_can_access_project`; factory access uses `can_read_factory`. Cost keys match the existing site/factory cost gates. |
| Dates and polling | PASS | Today tests cover IST default date, selected-date requests, 60-second polling, visibility pause/resume and stale responses. Signed-in browser selected 21/11/2026 and loaded that day's report. |
| Reconciliation/privacy | PASS | Rolled-back Test-project fixture on 06/10/2026: site ₹1,519.24, factory ₹525; difference ₹0. Operations site response omits cost and expense amounts. Draft/no-report costs are zero. |
| Layout/read-only | PASS | Signed-in Today was seen at 360px, 768px and desktop. No page overflow; tablet uses cards to avoid crowded columns. Last submission remains above the bottom navigation. Read-only report has zero editable controls, scrollable last section, and a settled 44×44 close target. Password screen did not block this check. |
| Existing flows/boundaries | PASS | No changes to Daily Site Report, Factory Daily Report, attendance, Running Bill, Setup, Production, Kanban, QC, dispatch, module stage transitions or SupervisorDailyLog. No existing RLS policies changed. No new edge functions, flags, schedules, reminders, role/account changes; rolled-back fixtures removed. |

## Expected to report

Observed project statuses: `Active` (2), `Archived` (4). No `In Progress` status was found. The reader treats `Active`, non-archived, non-design-only projects as execution projects. Such a project is expected if it has an active site engineer/site installation manager team assignment, or a non-archived site report/positive-hour site attendance within the selected date and previous six dates.

Observed team role labels: `project_architect`, `kickoff_assignee`, `task_role_holder`, `design_stage_owner`; assigned user roles are also checked to identify site-team members.

Factory is expected every day except Sunday, using ISO weekday constant **7**. Its row is still visible on Sunday, marked not expected, when factory access is allowed.

## Requested role coverage

Allowed: managing_director, finance_director, sales_director, architecture_director, super_admin, head_of_projects, planning_head, finance_manager, quantity_surveyor, costing_engineer, site_installation_mgr, head_operations, production_head.

Denied: site_engineer, factory_floor_supervisor, senior_factory_supervisor.

No existing active account: factory_floor_supervisor, senior_factory_supervisor, site_installation_mgr, quantity_surveyor. These four were tested with frontend role/route tests only; their live database-principal checks were not possible. No accounts or roles were created or changed.

Site cost is available to Tier 1/Super, head_of_projects, planning_head, finance_manager, quantity_surveyor, costing_engineer. Head Operations and Production Head can see factory cost but not site cost. Site Installation Manager can open Today without a cost key. Factory row visibility still follows `can_read_factory`.

## Rolled-back sample outputs

Selected fields only; no personal rates or wages:

```json
{
  "date": "2026-10-06",
  "name": "Test project - 1",
  "status": "Submitted",
  "hours": 12,
  "cost": {
    "attendance": 1019.24,
    "subcontract": 250,
    "consumables": 200,
    "expenses": 50
  }
}
```

Same site fixture, Head Operations caller:

```json
{
  "date": "2026-10-06",
  "name": "Test project - 1",
  "status": "Submitted",
  "hours": 12
}
```

Site: ₹1,019.24 + ₹250 + ₹200 + ₹50 = **₹1,519.24**, difference **₹0**. Factory: ₹400 + ₹0 + ₹100 + ₹25 = **₹525**. Distinct workers across both locations: **2**; total hours: **16**; submitted activities: **2**.

## Defects corrected

- Migration **0052**: an older submission timestamp could mask a later edit. Site and factory overview last-update fields now use the later timestamp. Fixed-time rolled-back regression verified both show 12:00 after a 10:00 submission, draft status stays Draft, and draft cost stays zero.
- Tablet columns were crowded at 768px: cards now remain in use until the desktop breakpoint.
- New dialog/date-picker touch targets inherited smaller defaults: these Today controls now use 44px targets. No shared report components were changed.
- Verification fixture initially omitted mandatory measurement location: fixture corrected to `site`; no production data was changed by the failed transaction.

## Test counts and limitations

- **580 passed, 4 skipped**, 48 frontend test files; Today-specific **26 passed**.
- **31 existing-principal role checks**; **2 anonymous denials**; additional rolled-back fixture assertions covered daily reconciliation, omitted commercial fields, cross-location people/hours, no-report status, Sunday expectation and timestamps.
- Four pre-existing edge authentication skips remain for legacy schedule headers: auto-submit-draft-expenses, daily-checkin-nudge, approval-rejection-dm, error-attribution-dm. No new frontend skips.
- Four requested roles had no existing active account: database-principal checks unavailable, frontend role/route coverage only.
- No live camera or GPS capture was tested on a phone.
- Latest automatic build: OK. No persistent fixture reports/attendance remained; reminder event count stayed zero.

**Publish > Update.**