
## Scope

Six independent fixes. I will ship them in this order so each builds cleanly on the previous one.

---

### Fix 1 — Project Setup Template distribution to tabs

The parser already writes to `project_billing_milestones`, `project_boq_items`, `project_stages`, `project_tasks`, `project_material_plan_items`, and `project_scope_items`. The real gap is (a) the post-upload confirmation screen, and (b) the consuming tabs not always re-fetching after upload.

- Replace the small Dialog with a richer **Confirmation Screen** showing: Billing N milestones, BOQ N items / N categories, Schedule N stages, Materials N items, Scope N items, plus a "Go to Project →" button.
- Verify each tab (Billing, Budget→BOQ, Schedule, Materials, Scope) calls its fetcher on mount and on a `project-setup-imported` event; wire `onImported` to dispatch that event.

### Fix 2 — Factory Floor + Site Hub schedule reads from `project_tasks` / `project_stages`

- Locate the hardcoded "Production Schedule" list inside `FactoryFloorMap.tsx` (or whichever tab renders it). Replace with a live query of `project_stages` (factory: `stage_number 1–15`) for the active project, joined with task-level rollup for actual_start / actual_end.
- Columns: Stage | Target Start | Target End | Actual Start | Actual End | Status (auto from `status` + first/last task transitions).
- Force the canonical 15 factory stage names from `FACTORY_STAGES` in `src/lib/hstack-stages.ts`. Confirm the list matches: Main Frame, Sub Frame — Panel Production, Drywall Works Completion, MEP Rough In, Internal Painting, Tiling, Exterior Wall Finishing, Internal Wall Finishing, Carpentry, MEP Final, Windows & Doors, Finishing, Snagging, QC Inspection, Dispatch. Remove any standalone "Insulation" / "Drywall" stage rows.
- Apply the same query pattern in Site Hub for `stage_number 16–23`.

### Fix 3 — Pending Claims ghost rows + validation + tooltip

- **Migration / data clean-up** (insert tool, since it's a DELETE on data): delete labour-claim rows where `worker_id IS NULL AND hours = 0 AND project_id IS NULL`.
- In `DailyLabourLog.tsx`: add Zod-style required-field validation (worker, project, stage, hours > 0). Block submit + show inline errors.
- Add an info tooltip next to the "SLA Breached" badge explaining "not approved/rejected within 4 working hours of submission".
- Add a TODO comment noting the future scoping rule (Rakesh sees only his supervised workers' claims) — actual RLS scoping deferred until the user account hierarchy is live.

### Fix 4 — Expense draft → submit UX

In `MyExpenses.tsx`:
- Add a per-row **"Submit for Approval"** button next to the Draft badge (uses existing handleSubmitAll logic but per-id).
- Add a top banner when there are unsubmitted drafts: count + deadline.
- Replace the existing static window text with a clear countdown: "opens in N days" / "closes in N days" / "closed — drafts carry to next month".
- In `ExpenseExcelUpload.tsx` (download report): prepend a header note row "This report shows approved expenses only. Drafts and pending claims are excluded."

### Fix 5 — Schedule tab: don't ask Karthik to re-upload

In the Schedule tab component (likely `MicroScheduleTab.tsx` or the project Schedule view): on mount, query `project_stages` for this project. If any stage rows exist, render the imported stages and **hide** the Upload Schedule button. Only show upload UI when zero stage rows exist for the project.

### Fix 6 — Fixed Assets + Service Reminders + Tools Inventory

**Migration** — new tables:
- `fixed_assets` (asset_name, asset_tag, category enum, make_model, serial_number, purchase_date, purchase_value, current_location, assigned_to_profile_id, service_interval_days, last_service_date, next_service_due (generated), warranty_expiry, notes, audit fields, is_archived).
- `fixed_asset_service_log` (asset_id, service_date, service_type, done_by, cost, next_service_date_override, notes, attachment_url).
- `tools_inventory` (item_name, qty_total, qty_in_use, qty_available (generated), location, assigned_to_profile_id, condition, notes).
- RLS: view = Azad / Vijay / Suraj / MD / Directors; insert/update fixed_assets = Azad / Vijay; insert service_log = Azad / Rakesh. Helper SECURITY DEFINER functions `can_view_fixed_assets(uid)`, `can_edit_fixed_assets(uid)`, `can_log_fixed_asset_service(uid)`.

**Edge function** — `fixed-asset-service-reminders` (cron daily 06:00 IST):
- For each asset where `next_service_due = today + 7d` → notify Azad ("Service due in 7 days").
- For each asset where `next_service_due < today` and no service logged since → notify Suraj (escalation).
- Cron registered via `supabase--insert` (project-specific URL + anon key per the schedule-jobs guide).

**UI** — `src/components/procurement/FixedAssetsTab.tsx`:
- Tabs: Fixed Assets · Tools Inventory.
- Fixed Assets table + "+ Add Asset" dialog with all listed fields, including category dropdown.
- Per-row "Service History" drawer with "+ Log Service" form (auto-updates next_service_due).
- Tools Inventory table with inline qty edits.
- Mounted at `Procurement → Fixed Assets` tab and added to AppSidebar under Production as "Equipment".

---

## Order of work (I will start as soon as you approve)

1. Fix 5 (smallest — guard the Schedule tab) and Fix 1 (confirmation screen + onImported event).
2. Fix 2 (Factory Floor + Site Hub live schedule).
3. Fix 3 (ghost-row delete + validation + tooltip).
4. Fix 4 (expense UX).
5. Fix 6 (Fixed Assets — biggest; one migration, one edge function, two UI components, sidebar entry).

I'll create migrations one at a time and ask for approval before each, per the workflow rules. Code changes will follow each approved migration.
