# SCHED-2c CONFIRM

## 1. Inspect findings

### Template cloning (unchanged in this batch)
- `projects_clone_task_templates` trigger → `clone_task_templates_to_project` (latest definition `drizzle/migrations/0070…sql:138-178`) copies the matching production system's `production_task_templates` into `project_tasks`: name, responsible role, task_type, display order, stage number → `task_id_in_schedule`, phase, duration, predecessors (stage codes), `is_qc_gate`. No dates, no unit, no `template_id`, no `stage_name`, no payment flag. Rejected once a baseline exists.
- On Test project - 1, 187 of these rows have no unit; 92 are QC gates, 11 have task_type qc_gate/payment, 3 have progress, 3 have BOQ/material links.
- If new projects stopped getting them, these would be empty until another path creates tasks: My Tasks list/summary, TaskUpdateSheet, Actuals & progress (MicroScheduleTab), Production dashboard, Management, Capacity planning task panels, Stage checklist drawer / Module schedule rollups / Factory floor (also need `stage_name`, which the clone never fills), Dispatch pack factory-work prefill (phase), Installation sequence dispatch date (task named "dispatch"), Material alerts schedule impact, Daily readiness brief, KPI delay metrics, AI agents overdue/productivity inputs, construction-day reminder eligibility, setup import code matching. Site daily report needs `work_category='construction'`, which clones never have.
- Not dependent: QC inspection wizard (reads templates directly), client portal (modules/GFC), panel handover (creates its own task).

### Tab strip cause
The shared `TabsList` style is itself `w-full max-w-full overflow-x-auto scrollbar-none`. Inside `ScrollableTabsWrapper`, the list scrolled instead of the wrapper, so the wrapper never saw overflow, never showed arrows, and the scrollbar was hidden: Scope was cut and Handover sat off-screen with no way to reach it. Fix: the project tab list is `w-max` so the wrapper scrolls; the wrapper also watches the list's width (tabs added after permissions load) and scrolls the active tab into view. No tab renamed or removed.

## 2. Files changed
- `src/components/projects/schedule/ScheduleTaskTable.tsx` (rewritten: compact rows, frozen Code/Name/Unit + Actions, sticky header, 70vh box, filters, unit→activity groups, legacy group collapsed, expandable rows, readable roles, predecessor notice)
- `src/components/projects/schedule/PredecessorPicker.tsx` (new: one popover, options built only when open, same unit by default, "show other units", checkbox multi-select)
- `ScheduleLibrary.tsx` (code order, check marks, sticky "Add selected (n)" bar, plain wording)
- `ScheduleGantt.tsx` (unit→activity groups, legend + month ruler on top, sticky names, own scroll box, one shading layer for Sundays/holidays, readable short bars, today text)
- `ScheduleHolidays.tsx` (company-wide title, ALL-projects warning, added by/when)
- `SchedulePublish.tsx` (clear unscheduled legacy tasks button + reason + confirm + result)
- `ScheduleUnits.tsx` (offset-note help, label placeholder from kind and existing labels)
- `ScheduleComments.tsx` (icon trigger in rows; dialog mounted only when open)
- `ScheduleTab.tsx`, `schedule-types.ts` (wiring, role names, extras naming, code sort)
- `src/pages/ProjectDetail.tsx`, `src/components/ui/scrollable-tabs.tsx` (tab strip)
- `drizzle/migrations/0074_sched2c_clear_unscheduled_tasks.sql` (new function only)
- Tests: `src/test/schedule-builder.test.tsx` (+3), `src/test/schedule-dom-measure.test.tsx` (new), `src/test/sched2c-clear-unscheduled.rollback.sql` (evidence)

## 3. New function
See `drizzle/migrations/0074_sched2c_clear_unscheduled_tasks.sql`. Editor-only (`can_edit_schedule`) + `user_can_access_project`; reason required (22023); refuses once any baseline exists (42501); deletes only rows with `unit_label IS NULL`, no planned dates, 0 % progress, no actual dates, not QC gate / payment milestone / qc_gate or payment type, no child tasks, subtasks, comments, BOQ or material-plan links, benchmarks, red flags, material alerts, panel handovers, archive links or daily-report progress/labour/workers. Returns `{deleted, skipped_with_progress}` and writes one `schedule_audit_log` row (`action='clear_unscheduled'`) with counts and the removed IDs.

### Real-account rollback test (Test project - 1)
Fixtures: clean legacy row, row with 20 % progress, row with a comment (written as the editor), row with a subtask, row in a unit with no dates, QC-gate row, row with an actual start date.
Result (`P0001 EVIDENCE OK (rolled back)`):
- legacy rows without dates before: 193 (187 real + 6 fixtures)
- Azad (named editor): `{"deleted": 91, "skipped_with_progress": 102}`; clean fixture deleted, all six protected fixtures kept; audit row present
- blank reason: 22023
- Vincent (active staff, project access, not an editor): 42501
- after a baseline row: 42501
Post-rollback: 199 tasks on the project, 0 `clear_unscheduled` audit rows. The function was not run for real on any project.

Note: on Test project - 1 about 97 of the 187 real legacy rows would be kept, mostly because 92 are QC gates.

## 4. Measurements
- 200 tasks (13 dated in a unit + 187 legacy), jsdom render of the Schedule tab: **44,071 → 654 elements**, **3,779 ms → 345 ms** (`schedule-dom-measure.test.tsx`, now asserts < 5,000).
- Live Test project - 1 (199 tasks), whole page in Chromium: 1,662 elements; page horizontal scroll 0 at 1440/1341/1024; task row height 44 px.
- Time to open (navigation to task table visible, dev server, includes sign-in and first-load compile): 10.0 s / 18.7 s / 15.9 s. Dev-server timing is not representative of the published app; not measured on the published site.

## 5. Tests
68 files, 968 tests passed, 0 failed.

## Not verified
- Clearing tasks for real (left for you on Test project - 1).
- The predecessor notice live in the browser (covered by code path only; tests cover the multi-select save payload).
- Published-site load time.
- Phone layout re-check after these changes (desktop widths only).
