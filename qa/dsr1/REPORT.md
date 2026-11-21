# QA Report — Daily Site Report Rebuild (commit f538519, migrations 0041–0043)

**Reviewer:** QA engineer (automated, read-only)
**Date:** 2026-11-21
**Branch/HEAD:** `origin/main` → `f5385197` (includes f538519 ✓)

---

## STEP 0 — Setup

| Check | Result |
|---|---|
| HEAD includes f538519 | ✓ PASS — `f5385197 Make Daily Site Report task-first with exact worker hours…` |
| `npm install` | ✓ PASS |
| `npx tsc --noEmit` | ✓ PASS — 0 errors |
| `npx vitest run` | ✓ PASS — **35 test files, 267 tests, 0 failed, 0 skipped** |

No tests were skipped.

---

## STEP 1 — Logic

### Evidence key
- `0041:L` = `drizzle/migrations/0041_mobile_site_report_task_workers_expenses.sql` line L
- `tw.ts:L` = `src/lib/site-report-task-workers.ts` line L
- `rules.ts:L` = `src/lib/site-report-rules.ts` line L
- `dsr.tsx:L` = `src/components/site/DailySiteReport.tsx` line L
- `chips.tsx:L` = `src/components/site/TaskWorkerChips.tsx` line L
- `rb.ts:L` = `src/lib/running-bill.ts` line L

---

| # | Check | Verdict | File:Line Evidence |
|---|---|---|---|
| 1 | Worker hours over-allocation rejected server-side | **PASS** | `0041:~20` — `HAVING sum(tw.hours) > a.hours → RAISE EXCEPTION 'Worker allocated hours exceed attendance hours.'` |
| 2 | Absent worker (no attendance) rejected server-side | **PASS** | `0041:~19` — `NOT EXISTS(SELECT 1 FROM labour_attendance WHERE hours>0) → RAISE EXCEPTION 'Worker must be present on this project and date.'` |
| 3 | `site_report_labour.hours` = sum of active task-workers; stale rows archived first | **PASS** | `0041:~34–43` archives existing rows, re-inserts changed task workers; `0041:~46–48` full sweep recalculates all tasks' labour.hours in one UPDATE |
| 4a | Calculated % = sum(cumulative+today)*progress_weight, BOQ value=0 falls back to manual | **PASS** | Server CTE `0041:~118–120`; client `tw.ts:24–28` — `if (!lines.some(b => progress_weight>0)) return manual` |
| 4b | Completed task forced to 100% | **PASS** | `0041:~120` — `task_status='completed' → pct=100`; client `tw.ts:24` — `if (completed) return 100` |
| 5 | Cumulative qty excludes current draft and other days' drafts | **PASS** | `0041:~118` — `NOT dm.is_archived AND (dm.id=r.id OR (dm.report_status='submitted' AND dm.measurement_date<=r.measurement_date AND dm.id<>r.id))` |
| 6 | Later report wins; only original submitter can re-edit and lower progress | **PASS** | `0041:~122` — `IF p.pct < p.old_pct AND NOT(r.report_status='submitted' AND r.submitted_by=auth.uid())` skips; `0019` existing guard skips already-newer-report tasks |
| 7a | Unconfirmed workers block submit | **PASS** | `rules.ts:42` — `if (c.unconfirmedWorkers) out.push(...)` ; `dsr.tsx:226` passes `unconfirmed_workers` count |
| 7b | Zero tasks with progress AND notes < 5 chars blocks submit | **PASS** | `rules.ts:43` — `if (c.tasksWithProgress===0 && c.notes.trim().length<5) out.push(...)` |
| 7c | Missing rate does NOT block submit (review flag only) | **PASS (by design)** | `submit_site_report` sets `wip_needs_review=true` but does not RAISE EXCEPTION; async review path is intentional |
| 8a | Expense negative/NaN amount rejected | **PASS** | `0041:~7` — `CHECK(amount_inr>=0 AND amount_inr<>'NaN'::numeric)` |
| 8b | Expense empty description rejected | **PASS** | `0041:~7` — `CHECK(length(btrim(description))>0)` |
| 8c | Archived expenses excluded from `get_site_report` | **PASS** | `0041:~97` — `WHERE NOT is_archived` in expenses subquery |
| 9 | Authenticated role cannot directly INSERT/UPDATE on `site_report_task_workers` or `site_report_expenses` | **PASS** | `0041:~2,8` — `GRANT SELECT` only to `authenticated`; `0041:~5,11` — SELECT-only RLS policies; writes require calling the SECURITY DEFINER RPCs |
| 10 | No worker wage or hourly rate fields returned to `site` role | **PASS** | `PresentWorker` type at `tw.ts:1` has only `worker_id, name, skill_type, contractor_name, attendance_hours` — no wage; `progress_weight` at `0041:~88` is `boq_rate/sum(boq_qty*boq_rate)` (dimensionless ratio, not an absolute rate) |
| 11 | `get_running_bill` allocation type handled in UI | **PASS** | `rb.ts:10` — `TaskRow` has `allocation?: "Exact" \| "Approximate"`; `rb.ts:36` — `r.allocation ?? "Approximate"` graceful fallback for legacy rows; both Excel sheet and UI render correctly |
| 12a | Worker chip disabled when no remaining hours | **PASS** | `chips.tsx:35` — `disabled={readOnly \|\| (!row && available <= 0)}` |
| 12b | "Select all present" skips workers with 0 remaining | **PASS** | `chips.tsx:23–24` — `if (hours > 0 && !next.some(...)) next.push(...)` |
| 12c | Manual % input hidden when BOQ has measurable lines | **PASS** | `dsr.tsx:400,419` — `manual = !lines.some(b => Number(b.progress_weight)>0)`; manual input only shown when `manual === true` |
| 13 | **Migration 0042 anchor depends on 0041** | **FAIL** | `0042` anchor `coalesce(t.completion_percentage,0)<100` is introduced by `0041`'s `get_site_report` patch; if `0042` runs before `0041`, anchor is missing → `RAISE EXCEPTION` |
| 13 | **Migration 0043 anchor depends on 0041** | **FAIL** | `0043` anchor `sum(q.today_qty)` is introduced by `0041`'s `submit_site_report` patch; same risk |
| 14 | Saving then reloading does not trigger another save (idempotent) | **PASS** | `dirty.current` starts `false` (`dsr.tsx:81`), set to `true` only by `touch()` on user interaction, reset to `false` by `saveNow()` at `dsr.tsx:152`; fresh `load()` does not call `touch()` |

---

## STEP 2 — Database

**Result: CANNOT TEST (6/6 checks)**

Credentials present in environment:
- `VITE_SUPABASE_URL` ✓ present
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) ✓ present

Credentials **missing**:
- `SUPABASE_SERVICE_ROLE_KEY` — **MISSING**

Without the service role key there is no way to invoke `_site_report_validate_task_workers()` directly (REVOKE from PUBLIC/anon/authenticated), execute raw SQL with BEGIN/ROLLBACK, or call RPCs as a known test user. All 6 database checks (1, 2, 3, 7, 9, 11) require server-side access.

---

## STEP 3 — Visual (Playwright)

Screenshots saved to `qa/dsr1/shots/`. Six screenshots total (2 per viewport).

### Auth wall encountered

All unauthenticated routes redirect to `/login`. The DSR component (`DailySiteReport.tsx`) could not be rendered. No test user credentials are available in this environment.

### Login page results (all viewports)

| Viewport | Horizontal overflow | Notes |
|---|---|---|
| 360×800 | **None** | scroll=360 client=360 |
| 390×844 | **None** | scroll=390 client=390 |
| 768×1024 | **None** | scroll=768 client=768 |

No horizontal overflow on the login page at any tested width.

### DSR component static analysis (code review)

The following overflow/layout protections are present in the source:

| Element | Protection | File:Line |
|---|---|---|
| Outer wrapper | `max-w-2xl mx-auto w-full min-w-0` | `dsr.tsx:345` |
| Task card | `min-w-0` on card and inner spans | `dsr.tsx:402,405` |
| Task name | `break-words` | `dsr.tsx:405` |
| Worker chips (manpower summary) | `max-w-full whitespace-normal break-words` | `dsr.tsx:460` |
| Chip button (TaskWorkerChips) | `max-w-full whitespace-normal text-left` | `chips.tsx:35` |
| Chip worker name | `break-words` | `chips.tsx:36` |
| Hours input | `w-24 max-w-full` bounded | `chips.tsx:38` |
| Sticky bottom submit bar | `fixed bottom-16 left-4 right-4 md:sticky` | `dsr.tsx:510` |
| Expense rows | `min-w-0` containers | `dsr.tsx:467` |
| Quantity row grid | `grid-cols-[minmax(0,1fr)_6rem]` — first col shrinks | `dsr.tsx:273` |

No obvious overflow risk found in static analysis. Full interactive visual confirmation is **CANNOT TEST** without auth.

---

## STEP 4 — Ranked Bugs and Findings

### BUG-1 (HIGH) — Migration 0042 and 0043 have undeclared sequential dependency on 0041

**Files:** `drizzle/migrations/0042_mobile_report_previous_completed_tasks.sql:1`, `drizzle/migrations/0043_mobile_report_progress_alias_fix.sql:1`

**Problem:** Both migrations patch live PostgreSQL functions using `pg_get_functiondef()` + string-replace. Their anchor strings (`coalesce(t.completion_percentage,0)<100` for 0042; `sum(q.today_qty)` for 0043) are introduced by migration 0041's own patches. If a replay, partial migration, or tooling ever runs 0042 or 0043 before 0041, they will `RAISE EXCEPTION '... anchor missing'` and roll back, leaving the database in an inconsistent state with no clear error message pointing to ordering.

**Fix:** Add an explicit guard at the top of 0042 and 0043:
```sql
-- 0042: guard
DO $$ BEGIN
  IF position('coalesce(t.completion_percentage,0)<100' IN pg_get_functiondef('public.get_site_report(uuid,date)'::regprocedure)) = 0
  THEN RAISE EXCEPTION '0042 requires 0041 to have run first (get_site_report anchor missing)'; END IF;
END $$;
```
Similarly for 0043. This turns a silent mid-patch failure into a clear dependency error at the guard statement.

---

### BUG-2 (MEDIUM) — Changing report date while autosave debounce is pending silently drops unsaved edits

**File:** `src/components/site/DailySiteReport.tsx:81,152,157–162,350`

**Problem:** `dirty.current` is set to `true` by `touch()` on every user edit and reset to `false` only inside `saveNow()`. The date `<select>` calls `setDate()` which re-runs `load()`. All state setters inside `load()` cause the autosave `useEffect` to fire. At this point, `dirty.current` is still `true` from the user's edits to the old date, so `saveNow()` runs — but it now uses the new date's freshly loaded state (not the user's edits). The user's changes to the old date are silently abandoned.

**Repro:** Edit a task on date D, do not wait 900ms, change to date D−1. Edits to date D are never persisted.

**Fix:** Add `dirty.current = false;` early in `load()` (before state setters), and optionally call `saveNow()` synchronously before updating `date`:

```typescript
// In load(), line 84, add:
dirty.current = false;
if (timer.current) window.clearTimeout(timer.current);
```

Or intercept the date `<select>` onChange to flush the pending save first.

---

### BUG-3 (LOW) — Hours input `max` attribute does not prevent out-of-range entry

**File:** `src/components/site/TaskWorkerChips.tsx:38`

**Problem:** `<Input ... max={Math.min(16, available)} ...>` sets the HTML `max` attribute, but browser `type="number"` inputs do not enforce `max` on keyboard input — the user can type a value exceeding the max and no immediate visual error is shown until `workerAllocationProblems()` fires. On mobile, the native number keyboard gives no max indicator.

**Severity:** LOW — server validation and `workerAllocationProblems()` client-side check both catch this before submit; it is a UX annoyance, not a data integrity hole.

**Fix:** Add an `onChange` guard that clamps or rejects values above `Math.min(16, available)`:
```typescript
onChange={e => {
  const v = Number(e.target.value);
  if (v > Math.min(16, available + (row?.hours ?? 0))) return;
  onChange(rows.map(...));
}}
```

---

### CANNOT-TEST items

| Item | Reason |
|---|---|
| DB check 1: over-allocation exception at RPC level | `SUPABASE_SERVICE_ROLE_KEY` missing |
| DB check 2: absent worker exception at RPC level | `SUPABASE_SERVICE_ROLE_KEY` missing |
| DB check 3: labour hours recalculation round-trip | `SUPABASE_SERVICE_ROLE_KEY` missing |
| DB check 7: unconfirmed workers RPC guard | `SUPABASE_SERVICE_ROLE_KEY` missing |
| DB check 9: authenticated INSERT blocked by RLS | `SUPABASE_SERVICE_ROLE_KEY` missing |
| DB check 11: running bill exact vs. approximate allocation | `SUPABASE_SERVICE_ROLE_KEY` missing |
| Visual: TaskWorkerChips chip layout at 360px | No test user credentials; login wall blocks DSR |
| Visual: Expense row overflow at narrow viewport | Same |
| Visual: Sticky submit bar overlapping content | Same |
| Visual: Empty-state ("No present workers") rendering | Same |

---

## Summary

| Category | Count |
|---|---|
| PASS | 18 |
| FAIL | 3 (BUG-1, BUG-2, BUG-3) |
| CANNOT TEST | 10 |

**Highest-priority action:** BUG-1 (migration ordering guard) is the only risk that could silently corrupt production database state. The other two bugs are runtime UX issues. All logic, security grants, RLS policies, and server-side validation checks passed static analysis.
