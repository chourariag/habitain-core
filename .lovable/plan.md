
# KPI Dashboard — Auto-RAG from Live Data

Builds on the existing `kpi_definitions` / `kpi_snapshots` / `kpi_targets_history` tables and the `KPI` + `KPISettings` pages. Adds the metric calculators, nightly recompute, MD note, employee self-view, and the 13-person overview grid.

## 1. The 13 KPI employees (mapped to existing roles)

| Name | Role used for KPI definitions |
|------|-------------------------------|
| Suraj Rao | `head_operations` |
| Azad Ali | `production_head` |
| Awaiz Ahmed | `site_installation_mgr` |
| Karthik | `planning_engineer` |
| Mohammed Nakeem | `costing_engineer` |
| Vijay | `procurement` |
| Tagore | `qc_inspector` |
| Bala | `delivery_rm_lead` (logistics/R&M) |
| Rakesh | `factory_floor_supervisor` |
| Sandeep | `stores_executive` |
| Nakeem | second costing — same role, identified by profile |
| Mary | `finance_manager` |
| Venkat | `principal_architect` (Operations Architect) |

A new `kpi_tracked_employees` config table pins which 13 `auth_user_id`s are shown on the MD overview grid (resolved by `display_name` match on first run, editable in Super Admin → KPI Settings).

## 2. Database

Migration adds:
- `kpi_tracked_employees(id, user_id unique, sort_order, is_active)` — drives the 13-card grid.
- `kpi_md_notes(id, user_id, month date, note, written_by, created_at)` — one note per employee per month, MD-only writes.
- `kpi_snapshots`: add `period_type` (`daily`|`weekly`|`monthly`), `period_date`, `metric_payload jsonb`, drop reliance on `week_start_date` only. Backfill existing rows as `weekly`.
- Seed `kpi_definitions` for every metric in the spec (rake → Rakesh's 4 metrics, Azad's 4, Awaiz's 3, etc.) with `kpi_key`, `target_value`, `unit`, `measurement_period`, `coaching_template_below/above`. Idempotent upsert by `kpi_key`.
- RLS: `kpi_md_notes` readable by MD/directors + the subject employee, writable by MD only. `kpi_tracked_employees` readable by all authenticated, writable by super_admin.

## 3. Metric calculators — single edge function `kpi-recompute`

One Deno edge function with a `metric_key → calculator` map. Each calculator returns `{ actual, denominator, status: 'green'|'amber'|'red'|'no_data', score 0–100 }`. Examples:

- `rakesh.measurement_submission_rate` — count distinct submission days in `daily_measurements` (location='factory') over working days in window.
- `azad.module_on_time_dispatch` — `dispatch_packs.actual_dispatch_date <= planned_dispatch_date`.
- `azad.ncr_closure_hours` — avg `closed_at - raised_at` from `ncrs`.
- `awaiz.installation_sequence_lead_time` — `installation_sequence_docs.created_at` vs `dispatch_packs.planned_dispatch_date - 14d`.
- `karthik.project_setup_completeness` — count of project_setup uploads per project.
- `nakeem.wo_approval_turnaround` — `work_orders.approved_at - created_at`.
- `vijay.po_lead_time`, `vijay.grn_within_24h`, `vijay.vendor_otd`.
- `tagore.qc_turnaround`, `tagore.ncr_accuracy`, `tagore.qc_checklist_complete`.
- `venkat.dq_response_hours`, `venkat.drawing_on_time`, `venkat.client_approval_hours`.
- `mary.invoice_within_milestone`, `mary.payslip_by_5th`, `mary.tally_upload_by_10th`.
- `bala.rm_response_hours`, `bala.amc_renewal_lead`.
- `sandeep.grn_accuracy`, `sandeep.stock_count_done`, `sandeep.dispatch_sign_within_2h`.
- `suraj.projects_on_schedule`, `suraj.weekly_review_done`, `suraj.escalations_within_sla`.

Status mapping per definition: `green` if actual meets target, `amber` within ±10–15%, `red` beyond that, `no_data` if denominator = 0 or table empty.

Function modes:
- `?mode=daily` — recompute today's snapshot for all 13.
- `?mode=weekly` — aggregate the last 7 daily snapshots, write a `period_type='weekly'` row, and post a notification to MD with team RAG vs prior week (Monday digest).
- `?user_id=…` — recompute live for one user when the dashboard opens (so screen always reflects fresh data without waiting for cron).

Cron via `pg_cron` + `pg_net` (set up with `supabase--insert`):
- 00:05 IST daily → `mode=daily`
- Mon 08:00 IST → `mode=weekly`

## 4. UI changes

### Admin → KPI Dashboard (rebuild Director view top section)
- Replaces the current "departments accordion" header with a **KPI Overview Panel**: responsive grid of 13 employee cards.
- Each card: avatar, name, role, overall RAG dot, top 3 metrics with mini RAG dots and value/target. "Insufficient Data" pill instead of red when status is `no_data`.
- Card click opens the existing `KPIScorecard` drilldown, augmented with:
  - 4-week trend sparkline per metric (queries weekly snapshots).
  - "Last week vs this week" delta.
  - **MD note panel** — month picker, single textarea, save button (only `is_md(auth.uid())`).
- Departments accordion stays below for directors who want the broader rollup.

### My HR → My KPIs (new tab)
- Add `MyKpisTab.tsx` to `Profile.tsx` / `AdminHR.tsx` "My HR" tabs.
- Renders `KPIScorecard` for `auth.uid()` only — same metrics, same RAG, no compensation data, no other employees visible.

### Super Admin → KPI Settings (extend existing page)
- Existing per-definition target editor stays.
- New section "Tracked Employees" — list 13 rows mapped to profiles, allow swap if a person changes.

## 5. Notifications

- Monday 08:00 weekly digest: insert one notification per director/MD with link to KPI dashboard, summarising team avg + count of red employees vs prior week.
- Real-time: no per-metric pings (would be too noisy).

## 6. Files

New:
- `supabase/migrations/<ts>_kpi_dashboard.sql`
- `supabase/functions/kpi-recompute/index.ts`
- `src/components/kpi/KpiOverviewGrid.tsx`
- `src/components/kpi/KpiEmployeeCard.tsx`
- `src/components/kpi/KpiTrendSparkline.tsx`
- `src/components/kpi/MdNotePanel.tsx`
- `src/components/hr/MyKpisTab.tsx`
- `src/lib/kpi-metrics.ts` — metric metadata (display labels + per-role grouping for the cards).

Edited:
- `src/pages/KPI.tsx` — add overview grid above departments accordion; trigger `kpi-recompute?user_id=` on drilldown.
- `src/pages/KPISettings.tsx` — add Tracked Employees section.
- `src/pages/AdminHR.tsx` (or wherever My HR tabs live) — add "My KPIs" tab.
- `src/integrations/supabase/types.ts` — auto-regen after migration.

## 7. Rules enforced

- All scoring server-side in the edge function — UI never computes scores.
- `no_data` shows "Insufficient Data" badge, never red.
- Targets editable only via `kpi_definitions` (Super Admin → KPI Settings).
- Salary / compensation data never queried or shown.
- MD note is the only manual field; everyone else read-only.
- Employees never see other employees' scores (RLS already enforces this on `kpi_snapshots`; `MyKpisTab` only queries own `auth.uid()`).

## Open question

The spec lists "Nakeem" twice (Mohammed Nakeem at line 5 and Nakeem at line 8) and assigns Costing-Engineer KPIs to Mohammed Nakeem. Should the second "Nakeem" card just be Mohammed Nakeem (so 12 cards, not 13), or is Nakeem a separate person with a different role? I'll default to **12 unique cards (treating both as Mohammed Nakeem)** unless you confirm otherwise.
