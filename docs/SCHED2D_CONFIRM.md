# SCHED-2c follow-up (H–K) — CONFIRM

## H. Actuals Phase view
- Display-only mapping `displayPhaseFor` (src/lib/production-phases.ts): 'factory' → Factory Production (modular/hybrid) / Panel Production (panelised); 'site' → Site Installation / Site Erection; anything else → "Other". Stored phase values are unchanged.
- Test project - 1 (modular), 199 active tasks, live browser: Design 9, Procurement 11, Factory Production 121 (109 + 12 library 'factory'), QC + Dispatch 12, Site Installation 21, Finishing 10, Handover 12, Other 3 (legacy "Pre-Production"). Sum = 199. Before: 196 shown (the 3 Pre-Production tasks were not shown; the 12 'factory' tasks fell outside the system columns).
- The phase filter uses the same mapping and lists "Other".
- List: % box widened (w-20); Start/Finish show DD/MM/YYYY; Action column is frozen on the right.

## Inspect only — TaskUpdateSheet
- TaskUpdateSheet is opened only from MyTasksSection (Home → My Tasks, `onClick={() => setSelectedTask(task)}`). In Actuals, the List, Phase and Gantt views have no click handler on task names, cards or bars, so a click does nothing for any role. That is why nothing happened for the MD.
- MD (Tier 1, FULL_SCHEDULE + EDIT_ROLES): the List view has an inline % box and a Start button; Phase/Gantt are view-only.
- Planning engineer: same as MD.
- Site engineer (PRODUCTION_VIEW_ROLES): gets the read-only stage roll-up, not List/Phase/Gantt; updates are made only through My Tasks → TaskUpdateSheet.

## I. Holidays
- Inactive holidays show "Reactivate". This uses the same path as other holiday changes: a direct upsert before a baseline, or `schedule_change_holiday` with a required reason after a baseline. Holidays are never deleted.

## J. Visual (real viewport resize, Test project - 1, editor account)
- No horizontal page scroll at 1440 / 1341 / 1024.
- Task table: 1440 scrollWidth 1100 = clientWidth 1100, so it fits with no scroll. At 1341/1024, Code, Name and Unit are frozen on the left and Actions (Save/Comment) on the right.
- Units at 1024: labels don't wrap ("Module 2"); the Save column is frozen right and fully visible.
- Actuals list at 1024: the Action header is visible and frozen right.
- Gantt: grouped by unit then activity. The label column grows to fill any width the timeline does not use.

## K. Measurements
- Schedule tab DOM elements on Test project - 1: 1,664 (199 tasks, collapsed legacy group). Synthetic 200-task case from SCHED-2c: 44,071 before → 654 after.
- Time to open the Schedule tab (navigation incl. sign-in restore → task table visible), dev sandbox: 14.0 s. The published site was not timed.
- schedule_clear_unscheduled_tasks was NOT run.

## Tests
- New: src/test/phase-display.test.ts (mapping + Other catch-all). Full suite result below.

## Not verified
- Reactivate clicked live (the code path is the same as Add holiday, but I did not exercise it in a browser).
- Phone layout.
- The 'before' DOM count and open time on this exact project were not captured before the change.
