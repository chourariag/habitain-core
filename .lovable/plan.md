# Running Bill System — Daily Measurement Sheets

A large feature with new schema, two new entry tabs, a Running Bill view, WIP wiring, and scheduled escalations. Sized to fit cleanly into the existing app without changing established business logic.

## 1. Database (one migration)

New tables (RLS on, audit fields, no hard delete):

```text
boq_items
  id, project_id, item_code, description, unit, boq_qty, boq_rate,
  stage, trade ('general'|'electrical'|'plumbing'),
  created_by, updated_by, created_at, updated_at, is_archived

daily_measurements
  id, project_id, module_id (nullable for site), stage,
  measurement_date, location ('factory'|'site'),
  submitted_by, team_id, notes,
  is_locked (default true on insert),
  unlock_reason, unlocked_by, unlocked_at,
  created_by, updated_by, created_at, updated_at, is_archived

measurement_line_items
  id, measurement_id, boq_item_id, today_qty,
  cumulative_qty_snapshot, value_today_snapshot, pct_complete_snapshot,
  created_at
```

Indexes: `(project_id, module_id, measurement_date)`, `(boq_item_id)`, `(submitted_by, measurement_date)`.

A SECURITY DEFINER function `recalc_running_bill(_project_id)` returns per-BOQ aggregates (qty_done_factory, qty_done_site, value_earned). Called by the UI; not exposed as a generic RPC for arbitrary SQL.

RLS:
- `boq_items`: read = project access roles, write = Karthik/Suraj/super_admin/managing_director.
- `daily_measurements` + lines: read = project participants + finance + MD; insert = Rakesh (factory) / Mohan / Venugopal (factory, trade-filtered) / Nazim (site); update only when `is_locked = false`; unlock = Azad (factory) / Awaiz (site) / MD / super_admin.

## 2. Daily entry UI

Reusable component `MeasurementSheet` with a `location` prop:

- Date (today, locked), Project (current scope), Module (factory only), Stage (auto from module current stage / installation stage), Team dropdown.
- BOQ table filtered by stage and (for trade users) by trade. Today's Qty is the only editable column. Submit creates one `daily_measurements` row + N `measurement_line_items` rows server-side, snapshotting cumulative + value.
- Submitted entries render read-only with a "Request Unlock" action that pings the approver.
- "BOQ not uploaded yet — ask Karthik to upload Project Setup" empty state when no BOQ rows exist.

Mounted in:
- Production → Factory Floor → new tab **Measurements** (`/production?tab=measurements`).
- On Site Works → Site Diary → new tab **Measurements** (`/site-hub?tab=site-measurements`).

Trade filtering: Mohan (`electrical_installer`) → only `trade='electrical'`; Venugopal (`elec_plumbing_installer` for plumbing) → only `trade='plumbing'`.

## 3. Running Bill view

New component `RunningBillTable` driven by `recalc_running_bill`:
- Columns: Item | Unit | BOQ Qty | BOQ Rate | BOQ Value | Qty Done (Factory) | Qty Done (Site) | Total Qty Done | % Complete | Value Earned.
- Summary tiles: Total BOQ Value, Value Earned, % Complete, Remaining, 7-day Daily Burn.
- Mounted under Projects → Budget tab and Finance → Projects → Revenue & Margin.

## 4. WIP & revenue curve

WIP formula card: `materials (GRN sum) + labour (daily log × rate) + 5% overhead`. Displayed alongside Running Bill. Pure read; no schema changes to materials/labour.

Revenue curve: weekly planned value from `project_tasks` schedule vs weekly earned value from measurements — line chart in Finance → Projects → Revenue & Margin.

## 5. Escalations (edge function + cron)

New edge function `measurement-submission-checks`:
- 8pm IST daily: for each active project, find missing factory submission for today → notify Azad; missing site submission → notify Awaiz.
- For each user with no submission for 2 consecutive working days → notify Suraj + MD.
- Reuses existing `insertNotifications` via direct table insert (no new notification channel).

Cron via `pg_cron` + `pg_net` calling the function URL with the anon key. Created by `supabase--insert` (not migration) per the schedule rule.

## 6. AI anomaly flags

Inline checks computed client-side at submit time and stored on the measurement row as `anomaly_flags jsonb` (added in the migration). Three rules implemented in `src/lib/measurement-anomalies.ts`:
- Output vs labour: `today_qty > expected_per_worker × workers_logged_today` for that bay/stage.
- 100% complete without QC inspection record.
- Site item with no matching GRN for the required material.

Flags surface as red badges on the entry and feed the existing MD Dashboard data-compliance area (already on the dashboard scaffold).

## 7. KPI hook

Daily-entry consistency rolls into Rakesh's and Nazim's KPI scorecards via the existing `kpi-helpers` aggregator — add two metric definitions (`measurement_submit_streak`, `measurement_missed_days`) without changing the scorecard component.

## 8. Files

- Migration: `boq_items`, `daily_measurements`, `measurement_line_items`, `recalc_running_bill`, RLS, indexes.
- Edge function: `supabase/functions/measurement-submission-checks/index.ts`.
- Cron: separate `supabase--insert` call after function deploys.
- Components: `src/components/measurements/MeasurementSheet.tsx`, `RunningBillTable.tsx`, `WIPCard.tsx`, `RevenueCurveChart.tsx`.
- Lib: `src/lib/measurement-anomalies.ts`, `src/lib/measurement-helpers.ts`.
- Page edits: `src/pages/Production.tsx` (+Measurements tab), `src/pages/SiteHub.tsx` (+Measurements tab), `src/pages/Finance.tsx` (Revenue & Margin tab content), `src/components/projects/ProjectBudgetTab.tsx` (Running Bill section).
- KPI: `src/lib/kpi-helpers.ts` adds two metrics.
- Memory: new entry `mem://features/running-bill-system`.

## 9. Out of scope (call out for later)

- Importing BOQ from the existing Project Setup Template — needs the parser change. I will add a manual BOQ entry table in Projects → Budget for now and a follow-up prompt can wire the Excel parser.
- Replacing the existing stage-based WIP everywhere it's referenced — kept side-by-side; switching the canonical WIP source is a separate prompt.

## 10. Order of operations

1. Migration (waits for your approval).
2. Edge function + cron.
3. UI components and tab wiring.
4. KPI metric additions and memory entry.

Approve to proceed, or tell me what to adjust before I run the migration.