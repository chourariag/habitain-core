# Hybrid Schedule Overhaul — Implementation Plan

This is a large change touching the database, the project setup template, the Factory Floor UI, the Site Hub UI, escalation logic, and payment notifications. Splitting it cleanly so it can be built and verified in stages.

## Before I start — I need 2 things from you

1. **The 220-row task master file.** I have the *stage list* (1–24) and the QC/payment trigger map from your message, but I do not have the actual 220 task rows (e.g. P2.22, 3A.1–3A.3, 3R.1–3R.8, HY.2.1–HY.2.6, 6.1–6.12 etc. with their exact wording, order, and which stage each belongs to). Without that file the seed will be guesswork. **Please upload the schedule file (Excel or CSV).** I'll parse it and seed exactly what's there.

2. **Confirm one ambiguity:** stage 9 "Internal Wall Finishing" and stage 20 "Steel Extensions" are both marked *case-by-case / N/A if not in scope*. Should Karthik mark N/A **per module** at template fill time, or should the system show them and let Rakesh/Nazim mark N/A when the stage opens? (I'll default to per-module at template time unless you say otherwise.)

While you upload the file, here is the full plan so you can review structure.

---

## Part A — Database (single migration)

### A1. Extend `production_task_templates`
Add columns:
- `stage_name text` — the stage label (one of the 24 stages)
- `responsible_role text` — who ticks the checklist item
- `escalation_role text` — who is paged after 1 day overdue
- `is_qc_gate boolean default false`
- `is_payment_milestone boolean default false`
- `parallel_stage text` — null unless this stage runs parallel to another (e.g. Sub Frame ∥ Main Frame, Tiling ∥ Internal Painting)
- `special_note text` — free-text note shown in checklist (e.g. the "keep panel vertical" note after P2.22)
- `applies_to_systems text[]` — so Hybrid-only rows (HY.*, P2.33-HY) don't appear on Modular projects

### A2. Extend `project_tasks` (per-project instances)
- `stage_name text`
- `is_qc_gate boolean`
- `is_payment_milestone boolean`
- `escalation_role text`
- `escalated_at timestamptz` — set by the 1-day rule
- `qc_requested_at timestamptz` — set when Rakesh taps "Request QC Inspection"
- `qc_request_notified_user uuid` — Tagore's id at time of request

### A3. New table `project_stages`
One row per (project, module, stage) — this is what Karthik fills.
- `project_id`, `module_id` (nullable for site stages), `stage_number int`, `stage_name text`
- `planned_start date`, `planned_end date`
- `actual_start`, `actual_end`
- `status` (Upcoming | In Progress | QC Pending | Complete | N/A)
- `is_na boolean` — for stages 9 & 20 case-by-case

### A4. Rename "Ceiling" → "Drywall Completion"
Run `UPDATE` across:
- `production_task_templates` (phase_name, task_name, stage_name)
- `project_tasks` (phase, task_name)
- any seeded checklist labels

### A5. Seed the 220 tasks
**Driven by the file you upload.** Each row → one `production_task_templates` row tagged with its stage_name, responsible_role, escalation_role, QC/payment flags, and any special_note from the schedule.

---

## Part B — Project Setup Template (Excel)

Replace the current "Project Schedule" sheet in `src/lib/xlsx-templates.ts` with a stages-only sheet:

| Stage # | Stage Name | Module # | Planned Start | Planned End | N/A? |
|---|---|---|---|---|---|
| 1 | Main Frame | M1 | | | |
| 2 | Sub Frame – Panel Production *(∥ Main Frame)* | M1 | | | |
| … | (24 stages × N modules) | | | | |
| 17 | Erection | – | | | |
| … | (site stages, no module) | | | | |

- Pre-populated for the project's module count (read from `project_modules`)
- Header note explaining ∥ = parallel
- Stages 9 and 20 pre-marked with N/A dropdown
- **Removes** Design (1.1–1.9), Procurement (2.1–2.11), and 3P.1 from this sheet
- Upload parser (`ProjectSetupUpload.tsx`) writes to `project_stages`, then auto-clones the 220 template tasks under each stage row

## Part C — Factory Floor bay card (Rakesh / Azad)

In `src/components/production/ProductionKanban.tsx` and the bay detail sheet:

- Bay card shows the **active stage name** prominently
- Tap → opens a stage checklist drawer
- Drawer lists every task for that stage in display order, each as a checkbox
- Special-note items render as inline yellow callouts (no checkbox)
- Hybrid/Panelised conditional row after P2.27 reads `project.production_system`
- When all non-QC items for a stage are ticked AND the next item is a QC gate → show **"Request QC Inspection"** button
- Button writes `qc_requested_at` and inserts a notification to the `qc_inspector` role user
- Stage can't auto-complete until the QC gate row is signed off by a QC role

## Part D — QC inspector flow (Tagore)

- Notification deep-links to a "QC Inspection" sheet on the bay
- Sheet shows only the QC gate's checklist items
- Pass → marks QC task complete, stage → Complete, next stage unlocks
- Fail → opens existing NCR flow, stage → In Progress, button reappears for Rakesh after rework

## Part E — Site Hub stage cards (Nazim / Awaiz)

Mirror Part C in `src/pages/SiteHub.tsx` for stages 17–24:
- Active project shows site stage cards
- Same checklist + QC + escalation pattern
- Snagging (stage 23 / 6.1–6.3) escalation = Planning Head
- Handover (stage 24 / 6.4–6.12) escalation = SIM, then Planning Head

## Part F — Escalation engine (1-day rule)

New edge function `task-escalation` running daily:
- Find `project_tasks` where `planned_finish_date < now() - 1 day` AND `status != Completed` AND `escalated_at IS NULL`
- Insert notification to the user holding `escalation_role` for that task's project
- Stamp `escalated_at`
- Same pass for `project_stages`

Schedule via existing cron pattern. Escalation map encoded in seed data per A5.

## Part G — Payment milestone notifications

When a `project_tasks` row with `is_payment_milestone = true` is marked complete:
- Frontend completion handler calls `insertNotifications` with the 4 recipients (Finance Manager, Planning Head, Sales Director, MD), resolved by role
- Message format exactly as you specified, with milestone %, amount (read from billing milestones), project name, marker name

Targets: 3F.5, Shell & Core completion, 3R.5.

---

## Verification I'll run before handing back

1. Upload a sample template → confirm 24 stages × N modules render
2. Fill 1 module's stages, upload back → `project_stages` populated, 220 tasks cloned
3. Open bay card on a Hybrid project → checklist appears with correct special notes
4. Tick all items before P2.27 → QC button appears → notification lands on Tagore
5. Tagore signs off → stage completes, next unlocks
6. Backdate a task's planned_finish → run escalation function manually → confirm Azad gets notified
7. Mark 3F.5 complete → confirm 4 payment notifications fire

---

## What I'd like to do next

**Please upload the 220-row schedule file** (and answer the N/A timing question). Once I have it, I'll:
1. Run the migration (A1–A4 + seed from your file)
2. Ship the template + upload parser (Part B) so you can fill stages immediately
3. Then layer on Parts C–G

If the file is large, a Google Sheet link or CSV export works fine.