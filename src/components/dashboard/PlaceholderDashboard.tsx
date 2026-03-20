import type { AppRole } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";

// PHASE 5: populate all placeholder tiles with real KPI data from Supabase
const TIER2_TILES: Record<string, string[]> = {
  production_head: ["Panels by Stage", "Delayed Panels", "Open NCRs", "Material Requests Pending", "Daily Logs Missing Today", "Factory Utilisation %"],
  head_operations: ["Active Projects", "Schedule Health (%)", "Overdue Deliveries", "POs Pending Approval", "Upcoming Dispatch This Week", "Critical Path Alerts"],
  site_installation_mgr: ["Active Sites", "Dispatch Pipeline", "Site Readiness Incomplete", "Subcontractor Attendance Today", "Open R&M Tickets", "Handovers Due This Month"],
  finance_manager: ["Overdue Payments (₹)", "Invoices Due This Week", "POs Pending Director Approval", "Next Statutory Due Date", "Low Stock Items", "MTD Revenue (₹)"],
};

const TIER3_TILES: Record<string, string[]> = {
  factory_floor_supervisor: ["My Panels In Progress", "Delayed Panels (mine)", "Daily Log — Submitted Today", "Open NCRs on My Panels"],
  qc_inspector: ["Panels Awaiting QC", "Open NCRs Raised by Me", "QC Completions This Week", "Escalated NCRs"],
  planning_engineer: ["Schedule Slippage", "Stage Targets Due This Week", "Panels Missing Target Dates", "Upcoming Milestones"],
  costing_engineer: ["Material Requests Awaiting Approval", "POs Pending Costing Sign-off", "Approvals Done Today"],
  procurement: ["POs To Raise Today", "Overdue Supplier Deliveries", "Low Stock Items", "POs Awaiting Director Approval"],
  stores_executive: ["Low Stock Alerts", "Goods to Receive Today", "Pending GRNs", "Stock Value (₹)"],
  delivery_rm_lead: ["Dispatches Scheduled Today", "Open R&M Tickets (mine)", "R&M Completions This Week", "Overdue R&M"],
};

const TIER4_TILES = ["Active Design Projects", "Design Queries Assigned to Me", "GFC Checklist Pending", "Client Approvals Due This Week"];

interface Props {
  title: string;
  today: string;
  tier: 2 | 3 | 4;
  role: AppRole | null;
}

export function PlaceholderDashboard({ title, today, tier, role }: Props) {
  let tiles: string[] = [];
  if (tier === 4) {
    tiles = TIER4_TILES;
  } else if (tier === 2 && role && TIER2_TILES[role]) {
    tiles = TIER2_TILES[role];
  } else if (tier === 3 && role && TIER3_TILES[role]) {
    tiles = TIER3_TILES[role];
  } else {
    tiles = ["Active Items", "Pending Actions", "Completed This Week", "Alerts"];
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>{title}</h1>
        <p className="text-sm mt-1" style={{ color: "#666666" }}>{today}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map((label) => (
          <div
            key={label}
            className="rounded-lg border p-4"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#E0E0E0", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeftWidth: 3, borderLeftColor: "#006039" }}
          >
            <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: "#666666" }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>0</p>
            {/* PHASE 5: populate with real KPI targets for {role} */}
            <p className="text-[10px] mt-1" style={{ color: "#999999" }}>Data loads in Phase 5</p>
          </div>
        ))}
      </div>
    </>
  );
}
