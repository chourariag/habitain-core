import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";


type RoleCode = string;

interface SeedUser {
  full_name: string;
  role: RoleCode;
  department: string;
  email: string;
}

// Map user-spec role labels to existing app_role enum values
const SEED: { full_name: string; role: RoleCode; department: string }[] = [
  { full_name: "Gaurav Chouraria", role: "managing_director", department: "Leadership" },
  { full_name: "John Kunnath", role: "director", department: "Leadership" },
  { full_name: "Karan Nadig", role: "architecture_director", department: "Design & Engineering" },
  { full_name: "Shiv Choudhari", role: "director", department: "Leadership" },
  { full_name: "Suraj Rao", role: "planning_head", department: "Planning" },
  { full_name: "Karthik", role: "planning_engineer", department: "Planning" },
  { full_name: "Mohammed Nakeem", role: "costing_engineer", department: "Planning" },
  { full_name: "Stanley", role: "head_of_projects", department: "Operations" },
  { full_name: "Venkat", role: "head_operations", department: "Operations" },
  { full_name: "Ribunzad", role: "project_architect", department: "Design & Engineering" },
  { full_name: "Azad Ali", role: "production_head", department: "Production" },
  { full_name: "Rakesh", role: "factory_floor_supervisor", department: "Production" },
  { full_name: "Mohan", role: "electrical_installer", department: "Production" },
  { full_name: "Venugopal", role: "elec_plumbing_installer", department: "Production" },
  // Awaiz Ahmed (departed) removed from seed — account is deactivated, do not re-create.
  { full_name: "Nazim Raja", role: "site_installation_mgr", department: "Site Installation" },
  { full_name: "Bala", role: "logistics_manager", department: "Logistics" },
  { full_name: "Vijay", role: "procurement", department: "Procurement & Stores" },
  { full_name: "Sandeep", role: "stores_executive", department: "Procurement & Stores" },
  { full_name: "Gangadhar", role: "procurement_assistant", department: "Procurement & Stores" },
  { full_name: "Tagore", role: "qc_inspector", department: "Quality Control" },
  { full_name: "Mary", role: "finance_manager", department: "Finance" },
  { full_name: "Sindhu", role: "hr_admin", department: "HR & Administration" },
  { full_name: "Vaibhav", role: "super_admin", department: "Admin" },
  { full_name: "Lekha", role: "marketing", department: "Sales & Marketing" },
  { full_name: "Sharan", role: "sales_executive", department: "Sales & Marketing" },
  { full_name: "George", role: "sales_executive", department: "Sales & Marketing" },
];

function suggestEmail(name: string) {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
  return first ? `${first}@altree.in` : "";
}

type Status = "Not Created" | "Created" | "Active" | "Already exists" | "Error";

interface Row extends SeedUser {
  status: Status;
  message?: string;
  temporary_password?: string;
  busy?: boolean;
}

export function CreateAccountsTab() {
  const [rows, setRows] = useState<Row[]>(() =>
    SEED.map((s) => ({ ...s, email: suggestEmail(s.full_name), status: "Not Created" as Status }))
  );
  const [bulkRunning, setBulkRunning] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  // Refresh status from DB
  const refresh = useCallback(async () => {
    setHydrating(true);
    const { data } = await supabase
      .from("profiles")
      .select("email,is_active,display_name")
      .in("email", rows.map((r) => r.email).filter(Boolean));
    const byEmail = new Map((data ?? []).map((p: any) => [String(p.email).toLowerCase(), p]));
    setRows((curr) =>
      curr.map((r) => {
        const hit = r.email ? byEmail.get(r.email.toLowerCase()) : null;
        if (!hit) return { ...r, status: r.status === "Created" ? r.status : "Not Created" };
        return { ...r, status: (hit.is_active ? "Active" : "Created") as Status };
      })
    );
    setHydrating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((curr) => curr.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const validate = (email: string) => /^[^\s@]+@altree\.in$/i.test(email);

  const createOne = async (i: number): Promise<boolean> => {
    const r = rows[i];
    if (!r.email) { updateRow(i, { status: "Error", message: "Email required" }); return false; }
    if (!validate(r.email)) { updateRow(i, { status: "Error", message: "Must be @altree.in" }); return false; }
    if (r.status === "Created" || r.status === "Active") return true;

    updateRow(i, { busy: true, status: "Not Created", message: undefined });
    const { data, error } = await supabase.functions.invoke("super-admin-create-user", {
      body: { email: r.email, full_name: r.full_name, role: r.role, department: r.department },
    });
    if (error || (data as any)?.error) {
      const msg = ((data as any)?.error ?? error?.message ?? "Failed") as string;
      const exists = (data as any)?.already_exists || msg.toLowerCase().includes("already");
      updateRow(i, { busy: false, status: exists ? "Already exists" : "Error", message: msg });
      return false;
    }
    updateRow(i, {
      busy: false,
      status: "Created",
      temporary_password: (data as any).temporary_password,
      message: undefined,
    });
    return true;
  };

  const bulkCreate = async () => {
    setBulkRunning(true);
    let success = 0, fail = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.email || r.status === "Created" || r.status === "Active") continue;
      const ok = await createOne(i);
      if (ok) success++; else fail++;
    }
    setBulkRunning(false);
    toast.success(`Done — ${success} created, ${fail} failed`);
  };

  const downloadCsv = () => {
    const data = [["Name", "Email", "Temporary password", "Role"], ...rows.filter(r => r.temporary_password).map(r => [r.full_name, r.email, r.temporary_password || "", r.role])];
    const csv = data.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "hstack-new-credentials.csv"; link.click(); URL.revokeObjectURL(url);
  };

  const hasNewCredentials = useMemo(() => rows.some((r) => r.temporary_password), [rows]);
  const pendingCount = rows.filter((r) => r.email && r.status === "Not Created").length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-lg">Create All Accounts</h2>
          <p className="text-xs text-muted-foreground">
            Pre-loaded with the 27 confirmed users. Edit emails (must be @altree.in), then create.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refresh} variant="outline" size="sm" disabled={hydrating}>
            {hydrating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Refresh
          </Button>
          <Button onClick={bulkCreate} disabled={bulkRunning || pendingCount === 0} className="bg-primary text-primary-foreground" size="sm">
            {bulkRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
            Create All Accounts ({pendingCount})
          </Button>
          {hasNewCredentials && (
            <Button onClick={downloadCsv} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" /> Download CSV
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto bg-card border border-border rounded-lg">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2 font-semibold">Full Name</th>
              <th className="p-2 font-semibold">Role</th>
              <th className="p-2 font-semibold">Department</th>
              <th className="p-2 font-semibold">Email</th>
              <th className="p-2 font-semibold">Status</th>
              <th className="p-2 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.full_name} className="border-t border-border">
                <td className="p-2 font-medium">{r.full_name}</td>
                <td className="p-2 text-xs text-muted-foreground">{r.role}</td>
                <td className="p-2 text-xs">{r.department}</td>
                <td className="p-2">
                  <Input
                    value={r.email}
                    onChange={(e) => updateRow(i, { email: e.target.value, status: "Not Created", message: undefined })}
                    disabled={r.status === "Created" || r.status === "Active" || r.busy}
                    className="h-8 text-xs"
                    placeholder="name@altree.in"
                  />
                </td>
                <td className="p-2">
                  {r.status === "Active" ? (
                    <Badge className="bg-primary text-primary-foreground text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Active</Badge>
                  ) : r.status === "Created" ? (
                    <Badge variant="default" className="text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Created</Badge>
                  ) : r.status === "Already exists" ? (
                    <Badge variant="secondary" className="text-xs">Already exists</Badge>
                  ) : r.status === "Error" ? (
                    <Badge variant="destructive" className="text-xs gap-1" title={r.message}><AlertCircle className="h-3 w-3" />Error</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Not Created</Badge>
                  )}
                  {r.message && r.status === "Error" && (
                    <p className="text-[10px] text-destructive mt-0.5 max-w-[180px] truncate" title={r.message}>{r.message}</p>
                  )}
                </td>
                <td className="p-2 text-right">
                  {r.temporary_password && <div className="space-y-1"><span className="font-mono text-xs break-all">{r.temporary_password}</span><Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(r.temporary_password || "")}>Copy</Button></div>}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={r.busy || bulkRunning || !r.email || r.status === "Created" || r.status === "Active"}
                    onClick={() => createOne(i)}
                  >
                    {r.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Temporary passwords are only shown once after creation — download the CSV before leaving this page.
        Distribute to each person manually.
      </p>
    </div>
  );
}
