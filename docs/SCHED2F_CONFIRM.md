# SCHED-2f CONFIRM — revisions recalculate dates on the server

## 1. Inspect
- **schedule_add_task (before):** stored whatever planned dates the caller sent (usually none); no server calculation.
- **schedule_remove_task (before):** archived the task only. Successors kept the removed code in their predecessors and kept stale dates (and a later pre-baseline recalculation would refuse them as "predecessor does not exist").
- **schedule_revise_task (before):** saved start day/days/predecessors; dates untouched; no successor cascade.
- **schedule_recalculate_dates:** pre-baseline only; finish-to-start (`start = max(pred end) + 1`, end = start for 0-day, else start+days-1), unit Day 1 from project_schedule_units (unit-less → earliest module Day 1), dates from `schedule_working_date(day1, n)` (Sundays + active holidays off). The new helpers reuse exactly these rules/functions.

## 2. Changed SQL — `drizzle/migrations/0077_sched2f_revision_date_recalc.sql`
- New internal helpers (no client execute): `_schedule_end_day`, `_schedule_unit_day1`, `_schedule_recalc_one`, `_schedule_cascade_successors`.
- `schedule_revise_task`: when start_day/duration_days/predecessor_ids change, recalculates the task (start day derived from predecessors if only predecessors changed), cascades same-project/unit successors in dependency order, refuses cycles (names the chain), never moves started (actual start), progressed (>0 %) or removed tasks, writes one `cascade` audit row per moved task (same reason, actor). Returns old keys + `task`, `moved`, `not_moved`.
- `schedule_add_task`: dates computed by the server (start day from predecessors when not given).
- `schedule_remove_task`: successors that followed the removed task now follow its predecessors (`relink` audit row each), then cascade. A successor whose only predecessor was removed (with none of its own) keeps its start day.
- Snapshots untouched; holiday changes still never move stored dates (dates only change when a task is revised).

## 3. Rollback tests (`src/test/sched2f-revision-dates.rollback.sql`, Azad editor / prod.dbr4 non-editor; ended with EVIDENCE exception, all undone)
- (a) F01 start day 2, days 5 → 01/12/2026–05/12/2026 (was finish 03/12).
- (b) F03 2→4 days: F04 moved 02/12–08/12 → 04/12–10/12; 1 cascade audit row.
- (c) F04 with actual start 04/12/2026: not moved, reason "Already started on 04/12/2026"; dates unchanged.
- (d) Holiday 03/12 added via schedule_change_holiday: F01 stayed 05/12 until revised; revision → finish 07/12 (skips holiday Thu 03/12 and Sunday 06/12).
- (e) F03 after F04 → 22023 "Schedule dependency cycle: F03-TEST-M1 (…) -> F04-TEST-M1 (…) -> F03-TEST-M1 (…)".
- (f) non-editor → 42501. (g) blank reason → 22023.
- (h) added task after F01 → start day 7, 08/12–09/12; removing F01 re-linked it (1 relink row), predecessors now none, dates kept.
- (i) v3 published inside the rollback: diff F03 finish 01/12 → 04/12, F04 02/12–08/12 → 04/12–10/12.

## 4. Screen
- Notice after revision lists moved / not moved tasks (screenshot `/mnt/documents/sched2f/notice.png`, RPC response mocked from test (b) so no live data changed).
- History comparison shows dates as DD/MM/YYYY. All published/created timestamps shown in IST: banner "Published on 27/11/2026 00:23 (IST)" (`banner.png`).

## 5. Tests and limits
- 974 automated tests pass (2 new).
- Not verified: a real (unmocked) revision through the screen. Live data: F01-TEST-M1 still shows finish 03/12/2026 from the earlier revision; re-saving it as a revision will correct it.
