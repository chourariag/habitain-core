import {
  LayoutDashboard,
  FolderKanban,
  Factory,
  AlertTriangle,
  Clock,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  icon: any;
  accent?: "primary" | "secondary" | "success" | "warning";
}) {
  return (
    <div className="bg-card rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-card-foreground/70">{label}</span>
        <div className={`h-9 w-9 rounded-md bg-${accent}/10 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 text-${accent}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-card-foreground font-display">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Production overview · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Projects" value={0} icon={FolderKanban} accent="primary" />
        <StatCard label="Modules in Production" value={0} icon={Factory} accent="secondary" />
        <StatCard label="Pending Claims" value={0} icon={Clock} accent="warning" />
        <StatCard label="Open NCRs" value={0} icon={AlertTriangle} accent="primary" />
      </div>

      <div className="bg-card rounded-lg p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-card-foreground mb-4">
          Recent Activity
        </h2>
        <div className="text-sm text-card-foreground/60 py-8 text-center">
          No activity yet. Create your first project to get started.
        </div>
      </div>
    </div>
  );
}
