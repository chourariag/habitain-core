This is a large 6-part restructure. I'll deliver it in the order below so each piece can be verified before the next builds on it. Nothing destructive — old pages stay reachable until their replacements ship.

## 1 — Project Setup as the single source of truth

- Add `setup_uploaded_at` and `setup_uploaded_by_name` on `projects`. Stamp these in the upload flow.
- Hide Schedule / Materials / BOQ / Scope upload buttons whenever `setup_uploaded_at` is set. The only re-upload offered is "Re-upload Project Setup Template" (replaces all 5 sheets atomically).
- Billing tab stays manually editable (% and contract value), but its milestones list becomes read-only after upload.
- Add a small banner on each affected tab: *"Loaded from Project Setup Template — uploaded by {name} on {DD/MM/YYYY}"*.
- GFC Budget upload (BOQ v2) is left untouched — still gated on H1.

## 2 — Remove Modules tab from Projects

- Drop the Modules/Panels tab from `ProjectDetail`.
- Move module/panel counts into the project header as read-only chips (`{n} modules · {p} panels`), populated from the Project Setup upload.
- Module/panel CRUD remains only on Production → Factory Floor bay cards.

## 3 — Production restructure

New sidebar group **PRODUCTION**:
```text
├── Production Dashboard   (new)
├── Factory Floor          (slim down)
├── Capacity Planning      (Azad / Rakesh / MD only)
├── QC & NCR
├── Dispatch & Delivery    (new — moved out of Factory Floor)
└── Safety                 (moved from HR)
```

- **Production Dashboard** (`/production/dashboard`): project-scoped cards — Active Stage, Schedule (current + next 3 stages green/amber/red), Open NCRs, Material Gates. Azad-only extra cards: Floor Capacity (`6/9 bays`), Team logged today, Labour Cost This Week vs budget.
- Rename "Stage Velocity" → **"Production Pace"** (On pace / Slightly slow / Behind) everywhere it appears.
- Strip from Factory Floor: My Tasks strip, Floor Capacity tile, Production Pace tile. Keep bay cards, QC trigger buttons, Quality flag buttons.
- **Dispatch & Delivery** (`/production/dispatch`): tabs — Dispatch Pipeline · Delivery Checklist (3-party sign-off) · Dispatch Packs · Vehicle Arrangement. Restricted to Azad, Rakesh, Awaiz, Bala, Suraj, MD.

## 4 — QC inspector + stage list fix

- QC Inspection Step 1 reads inspector name from the active testing-mode persona (`useTestingMode()`) and falls back to the auth profile only when no persona is selected.
- Stage Type dropdown is rebuilt by querying `production_task_templates` where `is_qc_gate = true`, formatted as `{phase} — {task_name} ({stage_number})`. Removes the hard-coded Shell/Builder/Interiors options.

## 5 — On Site Works (renamed from Site Hub)

New sidebar group:
```text
ON SITE WORKS
├── Site Dashboard         (new — /onsite/dashboard)
├── Site Hub               (existing, simplified)
├── Daily Logs             (new — /onsite/logs)
├── Site Inventory         (new — /onsite/inventory)
├── Dispatch & Delivery    (link → /production/dispatch)
└── Site Readiness         (new — /onsite/readiness)
```

- **Site Dashboard**: project-scoped — current site stage + checklist %, planned vs actual site stages, subs active today, open punch list, days since last client update, next dispatch incoming.
- **Site Hub** keeps only: My Site Tasks (collapsed, max 3), Request Advance, Dispatch Pipeline (incoming), Schedule, Drawings, Handover Document, Material Requests, Factory Feedback, Work Orders, Installation Sequence. Everything else moves out.
- **Daily Logs**: 3 tabs — Site Diary (Nazim) · Labour Log · Subcontractor Log (idle reason required).
- **Site Inventory**: confirm incoming factory transfers, current site stock, raise material requests.
- **Site Readiness**: photo checklist (foundation, access road, crane, site office, utilities, safety barriers) + dry-run video + risk register + client briefing confirmation + submit-to-Suraj button (≥5 days before dispatch).

New tables: `site_readiness_checklists`, `site_inventory_items`, `subcontractor_daily_logs`, `installation_sequences` (or extend if existing).

## 6 — Awaiz fills Schedule + Installation Sequence

- Both inputs are locked until 14 days before planned dispatch (already done for Schedule; same gate applied to Installation Sequence).
- Installation Sequence form: order table (Module # · Position · Crane approach · Notes), crane-lift count, access restrictions, crane-operator notes, OR PDF/DWG upload.
- On save: insert notifications for Karthik and Suraj ("Site schedule + installation sequence set for {project}").

## Roll-out order

1. Project Setup lock-down (Change 1) + Modules tab removal (Change 2) + Modules counts in header.
2. QC inspector + stage list fix (Change 4) — fast, isolated.
3. Production restructure (Change 3): new Dashboard, Dispatch & Delivery page, Factory Floor cleanup, Stage Velocity rename, sidebar reorg.
4. On Site Works restructure (Change 5): new sidebar group, Site Dashboard, Daily Logs, Site Inventory, Site Readiness, Site Hub slim-down.
5. Awaiz Installation Sequence + 14-day gate + notifications (Change 6).

## Open question

This is multiple person-days of work and dozens of files. Do you want me to ship all 6 changes in a single pass (longer turnaround, one big diff), or land them in the order above in successive passes so you can verify after each block?