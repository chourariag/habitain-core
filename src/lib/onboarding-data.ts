/**
 * Role-specific onboarding content: features, steps, quizzes, practice tasks.
 */

export interface OnboardingFeature {
  name: string;
  whatItDoes: string;
  whyItMatters: string;
  howToUse: string[];
  practiceTask: string;
  practiceRoute: string;
  quiz: QuizQuestion[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface RoleOnboarding {
  estimatedMinutes: number;
  features: OnboardingFeature[];
}

const FACTORY_SUPERVISOR: RoleOnboarding = {
  estimatedMinutes: 8,
  features: [
    {
      name: "Production Gate",
      whatItDoes: "Track each module through 10 production stages — from Sub-Frame to Dispatch. Move modules between stages as work completes.",
      whyItMatters: "This is how Azad and Karthik know exactly where every module stands, without calling you.",
      howToUse: [
        "Go to Production and select a project",
        "Find the module card and tap the current stage",
        "Confirm stage completion to advance it",
      ],
      practiceTask: "Go to Production and check which modules are in progress today.",
      practiceRoute: "/production",
      quiz: [
        {
          question: "A module finishes Stage 4 Drywall today. What do you do in HStack?",
          options: ["Move it to Stage 5 in the production gate", "Call Azad to confirm", "Wait for Tagore to check it"],
          correctIndex: 0,
        },
        {
          question: "You have 3 workers assigned to MOD-007 today. Where do you record this?",
          options: ["WhatsApp the team group", "Supervisor Daily Log in HStack", "Email Karthik"],
          correctIndex: 1,
        },
        {
          question: "An NCR is raised for MOD-007 by Tagore. What is your first step in HStack?",
          options: ["Go to NCR, acknowledge it and set fix timeline", "Fix it immediately without recording", "Call Azad first"],
          correctIndex: 0,
        },
      ],
    },
    {
      name: "Supervisor Daily Log",
      whatItDoes: "Log daily work progress for each module — photos, workers assigned, hours worked, and issues encountered.",
      whyItMatters: "Your daily logs feed into the Gantt chart and help management see real vs. planned progress.",
      howToUse: [
        "Open Production and select your module",
        "Tap 'Daily Log' and fill in today's work",
        "Upload photos and submit before 7pm",
      ],
      practiceTask: "Log a daily entry for today on any module.",
      practiceRoute: "/production",
      quiz: [
        {
          question: "When should you submit your daily log?",
          options: ["Before 7pm every day", "Once a week on Friday", "Only when asked by Azad"],
          correctIndex: 0,
        },
        {
          question: "What must you include in every daily log?",
          options: ["Just the stage name", "Work completed, photos, and any issues", "Only worker names"],
          correctIndex: 1,
        },
        {
          question: "If a module has an issue that blocks progress, where do you record it?",
          options: ["In the daily log issues field", "Send a text to Suraj", "Don't record — fix it later"],
          correctIndex: 0,
        },
      ],
    },
  ],
};

const QC_INSPECTOR: RoleOnboarding = {
  estimatedMinutes: 10,
  features: [
    {
      name: "QC Inspection Wizard",
      whatItDoes: "Run structured quality inspections at Stage 9 for every module. Check items across Shell & Core, MEP, and Finishing categories.",
      whyItMatters: "Your inspections are the last quality gate before a module ships — they protect the company's reputation.",
      howToUse: [
        "Go to QC and select a module at Stage 9",
        "Choose the inspection type (Shell & Core, MEP, or Finishing)",
        "Check each item and submit the report",
      ],
      practiceTask: "Open a module at Stage 9 and start an inspection. Select Shell and Core as the stage type.",
      practiceRoute: "/qc",
      quiz: [
        {
          question: "At which production stage do you perform QC inspections?",
          options: ["Stage 9 — QC Inspection", "Stage 1 — Sub-Frame", "Stage 5 — Paint"],
          correctIndex: 0,
        },
        {
          question: "You find a defect during inspection. What do you do?",
          options: ["Raise an NCR in HStack", "Tell the worker to fix it quietly", "Skip it if it's minor"],
          correctIndex: 0,
        },
        {
          question: "Who gets notified when you raise an NCR?",
          options: ["The production head and factory supervisor", "Only the client", "Nobody — it's a private record"],
          correctIndex: 0,
        },
      ],
    },
    {
      name: "NCR Management",
      whatItDoes: "Create, track, and close Non-Conformance Reports when defects are found. Each NCR follows a workflow from detection to resolution.",
      whyItMatters: "NCRs drive accountability — every defect is tracked to root cause and resolution, reducing repeat issues.",
      howToUse: [
        "From QC, tap 'Raise NCR' on any inspection finding",
        "Fill in defect details, category, and severity",
        "Track resolution in the NCR timeline",
      ],
      practiceTask: "Go to QC and review the NCR register for any open items.",
      practiceRoute: "/qc",
      quiz: [
        {
          question: "What information is required when raising an NCR?",
          options: ["Defect description, category, and severity", "Just a photo", "Only the module number"],
          correctIndex: 0,
        },
        {
          question: "Can an NCR cause a module to go back to a previous stage?",
          options: ["Yes — stage regression is tracked automatically", "No — modules only move forward", "Only if the MD approves"],
          correctIndex: 0,
        },
        {
          question: "Where can you see total rework costs from NCRs?",
          options: ["In the QC Rework Summary tab", "Only in the finance module", "It's not tracked"],
          correctIndex: 0,
        },
      ],
    },
  ],
};

const SITE_MANAGER: RoleOnboarding = {
  estimatedMinutes: 8,
  features: [
    {
      name: "Site Hub",
      whatItDoes: "Your central dashboard for all site activities — daily progress, punch lists, dispatch tracking, and site diary entries.",
      whyItMatters: "Everything that happens on-site is recorded here — no more lost information in WhatsApp groups.",
      howToUse: [
        "Go to Site Hub and select your project",
        "Log daily progress for each active task",
        "Review and update punch list items",
      ],
      practiceTask: "Go to Site Hub and check the dispatch packs for your project.",
      practiceRoute: "/site-hub",
      quiz: [
        {
          question: "Where do you record daily site progress?",
          options: ["Site Hub daily progress section", "In an email to the office", "On paper and photograph it"],
          correctIndex: 0,
        },
        {
          question: "A module arrives damaged at site. What do you do first?",
          options: ["Log it in Site Receipt Checklist with photos", "Call the factory", "Accept it and fix on-site"],
          correctIndex: 0,
        },
        {
          question: "How do you request additional materials for site?",
          options: ["Through the material request in HStack", "WhatsApp the stores team", "Buy locally and claim later"],
          correctIndex: 0,
        },
      ],
    },
  ],
};

const FINANCE_MANAGER: RoleOnboarding = {
  estimatedMinutes: 12,
  features: [
    {
      name: "Finance Dashboard",
      whatItDoes: "View invoices, payments, project P&L, cash flow, and statutory compliance from a single dashboard with multiple tabs.",
      whyItMatters: "Real-time financial visibility means you catch overruns and compliance deadlines before they become problems.",
      howToUse: [
        "Go to Finance and browse through the tabs",
        "Check Invoices tab for pending invoices",
        "Review Statutory tab for upcoming filing deadlines",
      ],
      practiceTask: "Go to Finance > Statutory tab and check the next filing due date.",
      practiceRoute: "/finance",
      quiz: [
        {
          question: "Where do you check upcoming GST or TDS filing deadlines?",
          options: ["Finance > Statutory tab", "Finance > Invoices tab", "Ask the accounts executive"],
          correctIndex: 0,
        },
        {
          question: "An expense report exceeds the project budget. What flag appears?",
          options: ["A budget overrun flag on the expense", "Nothing — it gets auto-approved", "The expense is deleted"],
          correctIndex: 0,
        },
        {
          question: "How do you track project-level profitability?",
          options: ["Finance > Project P&L tab", "By manually calculating in Excel", "It's not available in HStack"],
          correctIndex: 0,
        },
      ],
    },
    {
      name: "Payment Approvals",
      whatItDoes: "Review and approve payment requests, expense claims, and advance settlements in a structured workflow.",
      whyItMatters: "Every payment goes through a digital approval trail — no more verbal approvals that get forgotten.",
      howToUse: [
        "Go to Finance > Payments tab",
        "Review pending approval items",
        "Approve or reject with a note",
      ],
      practiceTask: "Go to Finance > Payments and check if any approvals are pending.",
      practiceRoute: "/finance",
      quiz: [
        {
          question: "Who must approve an advance request above policy limits?",
          options: ["HOD first, then MD", "Any finance team member", "It auto-approves"],
          correctIndex: 0,
        },
        {
          question: "Where do you see the approval history for a payment?",
          options: ["In the payment detail timeline", "In a separate audit log page", "It's not tracked"],
          correctIndex: 0,
        },
        {
          question: "What happens when you reject an expense?",
          options: ["The submitter is notified with your rejection reason", "It's silently deleted", "Nothing happens"],
          correctIndex: 0,
        },
      ],
    },
  ],
};

const PROCUREMENT_ROLE: RoleOnboarding = {
  estimatedMinutes: 8,
  features: [
    {
      name: "Procurement Dashboard",
      whatItDoes: "Manage purchase orders from Tally uploads, track material availability, supplier intelligence, and the 30-day procurement plan.",
      whyItMatters: "Late materials delay production. This dashboard ensures you order on time with reliable suppliers.",
      howToUse: [
        "Go to Procurement and review the dashboard strip",
        "Check Material Availability tab for pending confirmations",
        "Review Supplier Intelligence for vendor reliability",
      ],
      practiceTask: "Go to Procurement and check the material availability confirmations tab.",
      practiceRoute: "/procurement",
      quiz: [
        {
          question: "How does HStack know when a material delivery is late?",
          options: ["It compares expected delivery date vs GRN date", "You must manually flag it", "It doesn't track this"],
          correctIndex: 0,
        },
        {
          question: "Where do you see a vendor's on-time delivery percentage?",
          options: ["Supplier Intelligence tab", "The PO upload screen", "You calculate it manually"],
          correctIndex: 0,
        },
        {
          question: "What should you do when uploading POs from Tally?",
          options: ["Add the expected delivery date for each PO", "Just upload — no extra info needed", "Email the vendor separately"],
          correctIndex: 0,
        },
      ],
    },
  ],
};

const STORES_ROLE: RoleOnboarding = {
  estimatedMinutes: 6,
  features: [
    {
      name: "Inventory & Stores",
      whatItDoes: "Track material stock levels, manage GRN entries, and handle material transfers between factory and site.",
      whyItMatters: "Accurate inventory prevents production stoppages and avoids over-ordering.",
      howToUse: [
        "Go to Procurement > Inventory section",
        "Check current stock levels",
        "Record GRN when materials arrive",
      ],
      practiceTask: "Go to Stores and check current inventory levels.",
      practiceRoute: "/procurement",
      quiz: [
        {
          question: "What is a GRN?",
          options: ["Goods Received Note — confirms material delivery", "General Resource Number", "A type of purchase order"],
          correctIndex: 0,
        },
        {
          question: "When should you record a GRN?",
          options: ["Immediately when materials are received and checked", "At end of week", "Only if asked"],
          correctIndex: 0,
        },
        {
          question: "How do you transfer materials to a site?",
          options: ["Through the Transfers tab in Procurement", "WhatsApp the site manager", "Load the truck and go"],
          correctIndex: 0,
        },
      ],
    },
  ],
};

const SALES_ROLE: RoleOnboarding = {
  estimatedMinutes: 7,
  features: [
    {
      name: "Sales Pipeline",
      whatItDoes: "Track deals from lead to close in a Kanban board. Manage quotations, client interactions, and handover checklists.",
      whyItMatters: "Your pipeline data drives revenue forecasting and helps management plan factory capacity.",
      howToUse: [
        "Go to Sales and view the Pipeline tab",
        "Drag deals between stages or click to edit",
        "Add notes and update deal values regularly",
      ],
      practiceTask: "Go to Sales and check your pipeline. Add a note to any existing deal.",
      practiceRoute: "/sales",
      quiz: [
        {
          question: "Where do you manage active sales deals?",
          options: ["Sales > Pipeline Kanban", "In a separate CRM tool", "Email spreadsheets to management"],
          correctIndex: 0,
        },
        {
          question: "Before committing a new project start date, what should you check?",
          options: ["Factory capacity on the Production page", "Just promise the earliest date", "Nothing — operations will figure it out"],
          correctIndex: 0,
        },
        {
          question: "What happens when a deal moves to 'Won'?",
          options: ["A handover checklist is triggered for project setup", "Nothing — you create the project manually", "The deal is deleted"],
          correctIndex: 0,
        },
      ],
    },
  ],
};

const DEFAULT_ROLE: RoleOnboarding = {
  estimatedMinutes: 5,
  features: [
    {
      name: "Dashboard & Navigation",
      whatItDoes: "Your personalized dashboard shows only the metrics and actions relevant to your role. Navigate to any section from the sidebar.",
      whyItMatters: "HStack replaces WhatsApp, Excel, and verbal updates — everything is in one place.",
      howToUse: [
        "Log in and review your dashboard cards",
        "Use the sidebar to navigate to your main section",
        "Check the notification bell for alerts",
      ],
      practiceTask: "Explore the dashboard and check your notification bell.",
      practiceRoute: "/dashboard",
      quiz: [
        {
          question: "Where do you see alerts and notifications?",
          options: ["The bell icon in the header", "In your email only", "There are no notifications"],
          correctIndex: 0,
        },
        {
          question: "How do you mark your daily attendance?",
          options: ["Tap Check In on the Attendance page", "Tell HR directly", "It's automatic"],
          correctIndex: 0,
        },
        {
          question: "Who do you contact if you need help with HStack?",
          options: ["Your HOD or the system administrator", "The client", "Nobody — figure it out"],
          correctIndex: 0,
        },
      ],
    },
  ],
};

export function getOnboardingForRole(role: string): RoleOnboarding {
  switch (role) {
    case "factory_floor_supervisor":
    case "fabrication_foreman":
      return FACTORY_SUPERVISOR;
    case "qc_inspector":
      return QC_INSPECTOR;
    case "site_installation_mgr":
    case "site_engineer":
      return SITE_MANAGER;
    case "finance_manager":
    case "accounts_executive":
      return FINANCE_MANAGER;
    case "procurement":
      return PROCUREMENT_ROLE;
    case "stores_executive":
      return STORES_ROLE;
    case "sales_director":
      return SALES_ROLE;
    case "planning_engineer":
    case "costing_engineer":
    case "quantity_surveyor":
      return { ...DEFAULT_ROLE, estimatedMinutes: 6 };
    default:
      return DEFAULT_ROLE;
  }
}
