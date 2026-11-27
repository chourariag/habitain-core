# BOQ-3a2 — Explicit schedule-unit ↔ factory-module links

- **Migration:** 0086 only, applied as `drizzle/migrations/0086_0086_boq3a2_unit_module_link.sql` (the migration tool added its own `0086_` prefix).
- **Implementation commit:** `PENDING_IMPLEMENTATION_COMMIT`.
- **Other migrations:** none. No BOQ-1/BOQ-2 table, rule, money calculation, Running Bill, Cost report, schedule task, or `schedule_task_id` change.

## Inspect findings
- Migration 0066 created `project_schedule_units` with project/kind/label, dates, audit fields and editor RLS. Migration 0085's `boq3_task_report` mapped units only by trimmed, case-insensitive module `name` or `module_code`.
- `modules` supplies `id`, `project_id`, `name`, `module_code`, `is_archived`. Pebble Beach House had **23/23 exact name matches** before migration.
- Existing schedule writes use `can_edit_schedule(auth.uid())`; project scope uses `user_can_access_project(auth.uid(), project_id)`. The new functions require both and refuse failures with SQLSTATE 42501.
- The table already has table-wide authenticated INSERT/UPDATE grants. PostgreSQL table-wide grants are not removed by a column-level REVOKE, so a **BEFORE INSERT/UPDATE trigger** protects `module_id`; only the checked function's transaction-local flag permits a link change.

## Build
- Added nullable `module_id` with its foreign key and a partial unique index on `(project_id, module_id)`.
- One-time backfill linked only exact, unambiguous, active same-project matches not already taken: **Pebble Beach House 23/23; Test project - 1: 5/7; Test project 2: 0/2**. Nothing was guessed.
- `schedule_set_unit_module` sets/clears links with server actor/timestamp fields. `schedule_auto_match_units` runs only on demand, never overwrites an existing link, and returns linked count plus skip reasons.
- `boq3_task_report` now prefers a valid explicit link, otherwise preserves exact name/code fallback. Each unit has `mapped_by = link | name | null`; an archived linked module is unmapped with `Linked module is archived`. All budget/earned/actual formulas are unchanged.
- Schedule Units has editor-only selectors and Auto-match; other users see plain text. Taken modules are disabled. Both actions refresh units and invalidate `["boq3_task_report", projectId]`. The report uses that query key and shows Linked / By name tags plus the requested unmapped guidance.

## Real-principal rollback harness — **15/15 passed**
File: `src/test/boq3a2-unit-module.rollback.sql`. Managing director = schedule editor; costing engineer = project member but non-editor. Every fixture was rolled back; post-check found zero BOQ3A2 fixture projects.

1. Set link — **PASS**.
2. Clear link — **PASS**.
3. Wrong-project module rejected — **PASS**.
4. Archived module rejected — **PASS**.
5. Same module on two units rejected — **PASS**.
6. Project-member non-editor refused with 42501 — **PASS**.
7. Direct authenticated `module_id` update in a fresh request state refused — **PASS**.
8. Auto/backfill rules linked only exact M2/M3 matches — **PASS**.
9. M1 (no exact match), ambiguous M5, missing M6 and taken M8 stayed unlinked; existing M7/M9 links were not overwritten; skip reasons returned — **PASS**.
10. Explicit M1 → `Module 1` link reported `mapped_by='link'`; budget ₹400, C=2, A=4 → **earned ₹200 exactly**, actual ₹200 — **PASS**.
11. Cleared M2 link still matched by exact name with `mapped_by='name'` — **PASS**.
12. M3 explicit link to `Other M3` overrode the conflicting name match — **PASS**.
13. Archiving M3's linked module made it unmapped with the required reason and no name fallback — **PASS**.
14. Running Bill output before/after byte-identical (md5 `673f66cc03743c8205e9a7540423ab25`) — **PASS**.
15. Cost report output before/after byte-identical (md5 `a2ad8efac7ed8ba232f51fe5609474cd`) — **PASS**.

The original BOQ-3a rollback suite also passed **11/11**, including its 42501 non-reader check and unchanged readers.

## Pebble Beach House report proof
The project has no locked BOQ link set. Before migration: `status=no_locked_links`, units **0**, mapped units **0**. After migration: `status=no_locked_links`, units **0**, mapped units **0** — output unchanged. Separately, its exact mapping candidates remained **23**, and the backfill created **23 explicit links**.

## Tests, build and screens
- Full suite: **1,011/1,011 tests passed**, 77 files, no skips.
- Preview build: **build OK** at 2026-11-27 06:08 UTC; no page errors in the signed-in checks.
- Real signed-in Pebble Beach screen (not mocked; no live mutation): `docs/boq3a2-evidence/units-1440.png` and `units-390.png`.
- At 390px the selector width equals its container (282px), height is **44px**, and page-level horizontal overflow is false. At 1440px it is 208×44px with no overflow.
- A live browser selection save was intentionally not performed; the real-principal rolled-back function tests cover set/clear and refusal behavior.
