# SCHED-2b — CONFIRM

## Result
The project **Schedule** tab now opens **Schedule plan**, built on the existing checked database functions. The previous Micro-Schedule remains under **Actuals & progress**, so actual-date and completion screens keep working. There were no database, role, flag-value, cron or account changes. The only new switch is `SCHEDULE_LEGACY_UPLOAD_VISIBLE=false`.

## 1. Inspection
- `ProjectDetail` controls tabs inline through the URL `tab` value, defaulting to `schedule`. Access goes through the existing `projects` module guard and project read path.
- The app already used shadcn cards, dialogs, tables, tabs, checkboxes, Sonner toasts, `date-fns` and Recharts. The existing Micro-Schedule Gantt was custom. The new Gantt uses plain CSS, with no new library.
- Before this change, `MicroScheduleTab` showed task readers and actuals, plus a legacy upload that deleted and reinserted tasks. `ProjectSetupUpload` handled a combined legacy upload and was already hidden. `ProjectSetupWorkbook` handled Schedule, BOQ, Material Plan and Rates.
- Displayed roles come from `get_user_role`, and the View as User persona can override them. Schedule write access comes only from `rpc("can_edit_schedule", { _uid: authUserId })`, mirroring `useCanCreateProject`.
- Feature switches live in `src/lib/phase-flags.ts`.

## Files
Added: `src/hooks/useCanEditSchedule.ts`, `src/components/projects/schedule/{ScheduleTab,ScheduleUnits,ScheduleLibrary,ScheduleTaskTable,ScheduleGantt,ScheduleHolidays,SchedulePublish,ScheduleHistory,ScheduleComments}.tsx`, `schedule-types.ts`, `src/test/schedule-builder.test.tsx`.
Changed: `ProjectDetail.tsx`, `MicroScheduleTab.tsx`, `ProjectSetupWorkbook.tsx`, `phase-flags.ts`, `phase-gates-ui.test.tsx`.

## Legacy upload switch
- With the switch false, `ProjectSetupUpload` and the Micro-Schedule template, upload and re-upload controls are hidden.
- The workbook template no longer includes a Schedule sheet, and any uploaded Schedule sheet is ignored. BOQ, Material Plan and Subcontract Rates uploads still work.
- I checked the commit functions: an empty schedule list loops over no rows, so it deletes and inserts no tasks.
- No code was deleted.

## Comment payload correction
New-file writes no longer send actor IDs or timestamps:
- Comment insert sends only `{project_id, task_id, body}`.
- Comment status change sends only `{status}`.
- Unit and holiday writes send only business fields; the database defaults and triggers fill `created_by`/`updated_by`.

Real database evidence:

| Comment | Author (filled by database) | Final status | Resolved / updated by (filled by database) |
|---|---|---|---|
| SCHED-2b editor verification | Venkat | resolved | Venkat |
| SCHED-2b non-editor verification | Tagore | resolved | Venkat |

- Venkat used the real browser to add his comment, mark it seen, then mark it resolved. Afterwards he did the same review for Tagore's comment. In both browser runs there were no 4xx responses and no “permission denied”.
- Tagore (`quality@altree.in`, QC inspector, Pebble Beach House member, `can_edit_schedule=false`) inserted his comment through his real authenticated session, using exactly the screen's payload, and got HTTP 201. Screen check limitation: his account, like every existing non-editor member, is on the mandatory password-change screen, so his phone screen could not be opened without changing his account.

## 2. Walkthrough evidence
- **(a) 1440px editor:** Venkat's real account on Pebble Beach House showed the builder, Units & Day 1, library, custom-task, holiday and publish areas. Page width was exactly 1440, with no horizontal scroll.
- **(b) 900px editor:** Venkat saw “Schedules are built on a desktop. Open HStack on a computer to edit.” There were no builder controls, and page width was exactly 900.
- **(c) 390px non-editor:** automated tests confirm comment-only controls with no edit, publish or recalculate buttons. A live phone screenshot was blocked by the password-change requirement above.
- **(d) After v1:** automated tests confirm that Revise and Remove with reason replace inline edits, and that Publish revision appears.

The full live sequence (Day 1 dates, library add, repeat, predecessors, publish v1/v2) was **not** run on Pebble Beach House. Publishing creates permanent baseline versions on a real project, so it needs a test project or your go-ahead.

## 3. Enforcement
Calling `schedule_recalculate_dates` with Tagore's session returned **HTTP 403 / 42501 “Schedule editor and project access required”**. His direct status change affected **0 rows**. The read-only screen shows no write buttons, and that is tested.

## 4. No client date or permission logic
Dates, start days, cycles and Day 1 warnings come from `schedule_recalculate_dates` or the revision functions. Write access comes from `can_edit_schedule`. The 1024px check only controls what the screen shows. The browser compares snapshots only to display history.

## 5. Tests
67 files, **964 passed**, 0 failed. Up from 955: 9 new schedule tests, covering the desktop builder, the 900px desktop-only message, phone read-only + comment, post-baseline revision controls, publish blocking on missing dates, status-only comment changes, snapshot differences, the default-off switch, and failure if `author_id`, `created_by`, `updated_by`, `resolved_by` or `resolved_at` returns to schedule payloads.

## 6. Not verified
- Live phone screen for a non-editor (blocked by password-change requirement).
- Live editor walkthrough of library add, repeat, predecessors, publish v1, revisions and v2 on a real project (deliberately avoided: permanent baselines).
- The 1024px live check rendered before the schedule finished loading. The 1440/900 checks loaded fully.
- Two real verification comments remain on Pebble Beach House task 1.1, both resolved.
