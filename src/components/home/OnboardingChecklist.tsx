import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";

interface OnboardingStep {
  label: string;
  description: string;
  path: string;
}

const ROLE_STEPS: Partial<Record<AppRole, OnboardingStep[]>> = {
  managing_director: [
    { label: "Revenue & Margin Dashboard", description: "View company-wide margins and financial health", path: "/finance" },
    { label: "Active Project Status", description: "See all ongoing projects and current stages", path: "/projects" },
    { label: "Open Escalations", description: "Review escalated NCRs and pending approvals", path: "/production" },
  ],
  super_admin: [
    { label: "Revenue & Margin Dashboard", description: "View company-wide margins and financial health", path: "/finance" },
    { label: "Active Project Status", description: "See all ongoing projects and current stages", path: "/projects" },
    { label: "Open Escalations", description: "Review escalated NCRs and pending approvals", path: "/production" },
  ],
  planning_engineer: [
    { label: "Schedule", description: "View and manage the production Gantt schedule", path: "/production" },
    { label: "My Tasks", description: "Review panels and milestones assigned to you", path: "/projects" },
    { label: "Procurement / Materials", description: "Check material availability and pending requests", path: "/procurement" },
  ],
  finance_director: [
    { label: "Revenue & Margin Dashboard", description: "Review revenue trends and project margins", path: "/finance" },
    { label: "Invoice Tracker", description: "Track outstanding client invoices", path: "/finance" },
    { label: "Cash Flow Statement", description: "Monitor cash inflows and outflows", path: "/finance" },
  ],
  sales_director: [
    { label: "Revenue & Margin Dashboard", description: "Review project revenue and margins", path: "/finance" },
    { label: "Active Projects", description: "Monitor all ongoing project statuses", path: "/projects" },
    { label: "Client Portal", description: "Review client approvals and payment timelines", path: "/client-portal" },
  ],
  architecture_director: [
    { label: "Active Projects", description: "Review all projects for design delivery", path: "/projects" },
    { label: "Variation Register", description: "Approve and manage design variations", path: "/variations" },
    { label: "SOP Library", description: "Review design and construction SOPs", path: "/sop-library" },
  ],
  production_head: [
    { label: "Factory Floor Map", description: "View bay allocations and panel locations", path: "/production" },
    { label: "Capacity Planning", description: "Check bay utilisation and bottlenecks", path: "/production" },
    { label: "Production Schedule", description: "Review the Gantt and stage targets", path: "/production" },
  ],
  head_operations: [
    { label: "Active Projects", description: "Monitor all projects and delivery status", path: "/projects" },
    { label: "Procurement", description: "Review purchase orders and material requests", path: "/procurement" },
    { label: "SOP Library", description: "Access standard operating procedures", path: "/sop-library" },
  ],
  site_installation_mgr: [
    { label: "Active Projects", description: "View project sites and installation stages", path: "/projects" },
    { label: "Site Diary", description: "Log and review on-site activity", path: "/projects" },
    { label: "Handover Packs", description: "Prepare and submit handover documentation", path: "/projects" },
  ],
  finance_manager: [
    { label: "Invoice Tracker", description: "Manage and track client invoices", path: "/finance" },
    { label: "Payments", description: "Record and review vendor payments", path: "/finance" },
    { label: "Statutory Compliance", description: "Check upcoming GST and TDS deadlines", path: "/finance" },
  ],
  accounts_executive: [
    { label: "Invoice Tracker", description: "Track all client invoices and due dates", path: "/finance" },
    { label: "Payments", description: "Process vendor payments and reconciliations", path: "/finance" },
    { label: "Finance Overview", description: "View the overall financial position", path: "/finance" },
  ],
  stores_executive: [
    { label: "Goods Received Notes", description: "Log and manage incoming goods receipts", path: "/procurement" },
    { label: "Low Stock Items", description: "Review items below reorder level", path: "/procurement" },
    { label: "Procurement Requests", description: "Check pending material purchase requests", path: "/procurement" },
  ],
  procurement: [
    { label: "Purchase Orders", description: "Review and raise purchase orders", path: "/procurement" },
    { label: "Supplier Management", description: "Manage supplier records and performance", path: "/procurement" },
    { label: "Pending Approvals", description: "Track POs awaiting director approval", path: "/procurement" },
  ],
  qc_inspector: [
    { label: "Panels Awaiting QC", description: "Review panels ready for quality inspection", path: "/production" },
    { label: "NCR Management", description: "Log and track non-conformance reports", path: "/production" },
    { label: "SOP Library", description: "Reference quality control procedures", path: "/sop-library" },
  ],
  factory_floor_supervisor: [
    { label: "Factory Floor Map", description: "View current bay layout and panel locations", path: "/production" },
    { label: "Daily Production Log", description: "Submit today's production progress", path: "/production" },
    { label: "My Panels", description: "Check panels assigned to your bay", path: "/production" },
  ],
  costing_engineer: [
    { label: "Material Requests", description: "Review and approve material cost requests", path: "/procurement" },
    { label: "Variation Register", description: "Review cost variations and approvals", path: "/variations" },
    { label: "Procurement", description: "Check purchase order costing and approvals", path: "/procurement" },
  ],
  delivery_rm_lead: [
    { label: "Dispatch Schedule", description: "View upcoming module dispatch schedule", path: "/production" },
    { label: "Active Projects", description: "Monitor delivery and R&M status per project", path: "/projects" },
    { label: "Site Diary", description: "Log R&M and post-delivery activities", path: "/projects" },
  ],
};

const DEFAULT_STEPS: OnboardingStep[] = [
  { label: "Dashboard", description: "Your home base for daily tasks and alerts", path: "/dashboard" },
  { label: "Projects", description: "Explore active projects and their status", path: "/projects" },
  { label: "Settings", description: "Configure your account and preferences", path: "/settings" },
];

const STORAGE_KEY = "onboarding_dismissed_v1";

interface Props {
  userRole: AppRole | null;
  userName: string;
}

export function OnboardingChecklist({ userRole, userName }: Props) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  if (dismissed) return null;

  const roleLabel = userRole ? (ROLE_LABELS[userRole] ?? userRole) : "User";
  const steps = (userRole && ROLE_STEPS[userRole]) ?? DEFAULT_STEPS;
  const firstName = userName.split(" ")[0];

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: "#E8F2ED", borderColor: "#B3D4C5" }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm" style={{ color: "#006039" }}>
            Welcome, {firstName}!
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#444" }}>
            You&apos;re logged in as <span className="font-medium">{roleLabel}</span>. Here are your key starting points:
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded p-0.5 hover:bg-black/10 transition-colors"
          aria-label="Dismiss onboarding"
        >
          <X className="h-4 w-4" style={{ color: "#006039" }} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {steps.map((step) => (
          <button
            key={step.label}
            onClick={() => navigate(step.path)}
            className="text-left rounded-lg border p-3 bg-white hover:shadow-md transition-shadow group"
            style={{ borderColor: "#B3D4C5" }}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{step.label}</p>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: "#006039" }} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: "#666" }}>{step.description}</p>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs h-7 px-3" style={{ color: "#006039" }}>
          Got it, dismiss
        </Button>
      </div>
    </div>
  );
}
