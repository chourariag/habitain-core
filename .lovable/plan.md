# Sidebar Navigation Overhaul

This is a navigation-only restructure. Per your rule "DATA CONNECTIONS REMAIN UNCHANGED", I will not touch Supabase queries, table structure, or business logic. I will reorganise routes, the sidebar tree, mobile nav, and create thin page wrappers that mount existing components/tabs in their new homes.

## 1. New sidebar tree (exact)

```
Dashboard
Approvals
Projects
Production
  ├ Capacity Planning        (Suraj/Azad/Karthik only)
  ├ Factory Floor
  ├ Floor Map
  ├ QC & NCR
  ├ Despatch & Delivery
  ├ Safety
  └ People                   (NEW)
On Site Works
  ├ Site Hub
  ├ Inventory
  ├ Site Diary               (NEW standalone)
  ├ Handover Document        (renamed)
  ├ People                   (NEW)
  ├ Installation Sequence
  └ Safety
Procurement
  ├ Dashboard
  ├ Material Plan
  ├ Inventory                (Inventory | GRN | Purchase Orders)
  ├ Transfers
  ├ Equipments               (Asset Register — merged)
  └ Repairs & AMC            (R&M | AMC)
Finance
  ├ Management               (MIS | P&L)
  ├ Projects                 (Revenue & Margin | Cash Flow)
  ├ General                  (Payments | Invoices | Bank Ledger | Statutory)
  └ Costing & Estimation     (WO | PO | Expense Approvals)
Design
  ├ Projects
  └ Design Queries
Sales
  ├ Sales Pipeline
  ├ Quotations
  └ Client Portal
ALTREE  (collapsible group header — not clickable)
  ├ HR
  │   ├ My HR
  │   └ HR Management
  ├ Admin                    (Admin + User Management merged)
  ├ Super Admin              (Vaibhav only — unchanged)
  └ Settings                 (Factory | Office locations)
```

## 2. Removals

- Remove from sidebar: Report Compliance/Weekly Reports, standalone "Flow" page, standalone Purchase Orders approval page, standalone Fixed Assets entry, R&M/AMC top-level entries, Production Dashboard, Site Dashboard, Knowledge → SOPs (not in spec — moved off sidebar; route still reachable), KPI Scorecard (not in spec; route remains), Alerts (not in spec; bell stays in header).
- Pages keep their files; only sidebar entries are cut so deep links and existing buttons continue to work.

## 3. New thin page wrappers (no logic changes)

- `/production/people` — tabs: Manpower Plan, Daily Labour Log, Labour Log Approvals, Labour Registers, Subcontractors. Mounts existing `WeeklyManpowerPlanner`, `DailyLabourLog`, `LabourClaimsTab`, `LabourRegisterTab`, `SubcontractorManagement`.
- `/site/people` — tabs: Labour Log, Subcontractors. Mounts the same site components already used inside Site Hub.
- `/site/diary` — Site Diary tab + Punch List tab (existing components).
- `/site/handover` — wraps existing `HandoverPack` and renames title.
- `/site/installation-sequence` — wraps existing `InstallationSequenceDoc`.
- `/site/safety` — same `Safety` page (route alias).
- `/procurement` keeps tabs but the "inventory" tab content gains GRN + Purchase Orders sub-tabs; the existing fixed-assets tab is renamed "Equipments" and uses the merged Asset Register component (already exists as `AssetRegisterTab`).
- `/procurement?tab=repairs` — Repairs & AMC tab embedding existing R&M and AMC pages.
- `/finance` tab keys reorganised into Management / Projects / General / Costing — same components mounted under new tab keys.
- `/design/projects` and `/design/queries` — split views of existing Design Portal.
- `/altree/admin` — merges Admin + User Management content (existing components).
- `/altree/settings` — Factory + Office location tabs (existing settings components).

## 4. Active-route highlight fix

The current scoring loop runs **per section**, so two sections can each elect a "best" item (HR Management vs Admin both light up). Fix: compute the single best match across the entire flattened nav once, then compare each item's key against that global winner. Result: exactly one highlighted row at any time.

## 5. ALTREE collapsible group

ALTREE renders as a non-clickable header with a chevron. Clicking toggles a single `useState` that hides/shows its 4 child sections. State persists in `localStorage` (`hstack_nav_altree_open`). On mobile, the same toggle drives the mobile nav grouping.

## 6. Mobile nav

`MobileNav.tsx` updated to mirror the top-level sections. Sub-pages reachable via the per-section drill-in (existing horizontal scroll bar + new section grouping). ALTREE collapses as one unit.

## 7. Role visibility

Reuses existing `canSeeSection` + per-item `roles` arrays. New gates:
- Capacity Planning: `["super_admin","managing_director","head_operations","planning_head","production_head"]` (Suraj/Azad/Karthik personas).
- Approvals top-level: MD + Directors only (already the case).
- HR Management: `hr_admin`, `finance_manager` (Mary), MD/super_admin.
- Super Admin: `super_admin` only (Vaibhav).
- Repairs & AMC, Equipments: existing procurement roles.
No role permission changes — only nav visibility.

## 8. Files touched

- Edit: `src/components/AppSidebar.tsx` (new tree + active-route fix + ALTREE collapse).
- Edit: `src/components/MobileNav.tsx` (mirror new sections).
- Edit: `src/App.tsx` (add new routes; alias removed routes to their new homes via `<Navigate>` so old links don't 404).
- Edit: `src/lib/role-nav.ts` (add new section keys: `approvals`, `site`, `finance`, `sales`, `altree`).
- Edit: `src/pages/Finance.tsx` (regroup tab keys into Management/Projects/General/Costing — UI only).
- Edit: `src/pages/Procurement.tsx` (rename Tally PO Upload tab → "Purchase Orders"; Equipments tab uses Asset Register).
- Create: `src/pages/ProductionPeople.tsx`, `src/pages/SitePeople.tsx`, `src/pages/SiteDiary.tsx`, `src/pages/HandoverDocument.tsx`, `src/pages/InstallationSequence.tsx`, `src/pages/DesignProjects.tsx`, `src/pages/DesignQueries.tsx`, `src/pages/AltreeAdmin.tsx`, `src/pages/AltreeSettings.tsx`.
- No DB migrations. No edge function changes. No query changes.

## 9. Out of scope (call out for later prompts)

These were referenced but require data/logic work — I will NOT build them in this prompt:
- Data Compliance Panel (live data computation).
- AI Anomaly Flags (model + rules engine).
- Announcements posting/viewing system.
- Two-stage expense flow rewiring (already partly built — verified, no further change here).
- Renaming Mary's permissions.

If you want any of those built, please send a follow-up prompt for each.

Approve to implement, or tell me what to change.