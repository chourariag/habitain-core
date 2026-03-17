import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, PackagePlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { NewMaterialRequestDialog } from "@/components/materials/NewMaterialRequestDialog";

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending_budget: { label: "Pending Budget Review", class: "bg-warning/20 text-warning-foreground" },
  pending_director_approval: { label: "Pending Director Approval", class: "bg-warning/20 text-warning-foreground" },
  pending_po: { label: "Pending PO", class: "bg-primary/20 text-primary" },
  po_raised: { label: "PO Raised", class: "bg-primary/20 text-primary" },
  received: { label: "Received", class: "bg-success/20 text-success-foreground" },
  rejected: { label: "Rejected", class: "bg-destructive/20 text-destructive" },
};

const URGENCY_CLASS: Record<string, string> = {
  urgent: "bg-destructive/20 text-destructive",
  standard: "bg-muted text-muted-foreground",
};

const REQUESTOR_ROLES = [
  "super_admin", "managing_director",
  "site_installation_mgr", "site_engineer", "factory_floor_supervisor",
  "fabrication_foreman", "production_head", "head_operations",
];

const APPROVER_ROLES = [
  "super_admin", "managing_director", "finance_director",
  "costing_engineer", "procurement", "stores_executive", "head_operations", "production_head",
];

export default function MaterialRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const canRequest = REQUESTOR_ROLES.includes(userRole ?? "");
  const canApprove = APPROVER_ROLES.includes(userRole ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [reqRes, projRes, roleRes] = await Promise.all([
      supabase.from("material_requests" as any).select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name"),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return { role: null, id: null };
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        return { role: data as string | null, id: user.id };
      }),
    ]);

    setRequests(reqRes.data ?? []);
    const projMap: Record<string, string> = {};
    (projRes.data ?? []).forEach((p) => { projMap[p.id] = p.name; });
    setProjects(projMap);
    setUserRole(roleRes.role);
    setUserId(roleRes.id);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (requestId: string, action: string) => {
    try {
      const { client, session } = await getAuthedClient();
      let update: Record<string, any> = {};

      if (action === "approve_budget") {
        update = { status: "pending_po", budget_approved_by: session.user.id, budget_approved_at: new Date().toISOString() };
      } else if (action === "over_budget") {
        update = { status: "pending_director_approval", is_over_budget: true, budget_approved_by: session.user.id, budget_approved_at: new Date().toISOString() };
      } else if (action === "director_approve") {
        update = { status: "pending_po", director_approved_by: session.user.id, director_approved_at: new Date().toISOString() };
      } else if (action === "raise_po") {
        update = { status: "po_raised", po_raised_by: session.user.id, po_raised_at: new Date().toISOString() };
      } else if (action === "mark_received") {
        update = { status: "received", received_by: session.user.id, received_at: new Date().toISOString() };
      } else if (action === "reject") {
        update = { status: "rejected", rejection_reason: "Rejected by approver" };
      }

      const { error } = await client.from("material_requests" as any).update(update).eq("id", requestId);
      if (error) throw error;
      toast.success("Request updated");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Material Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage material procurement requests</p>
        </div>
        {canRequest && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Request
          </Button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="bg-card rounded-lg p-12 text-center shadow-sm">
          <PackagePlus className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No material requests yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">Material</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Qty</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Urgency</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  {canApprove && <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const statusCfg = STATUS_CONFIG[r.status] ?? { label: r.status, class: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="font-medium text-card-foreground">{r.material_name}</div>
                        {r.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{r.notes}</p>}
                      </td>
                      <td className="p-3 text-card-foreground">{r.quantity} {r.unit}</td>
                      <td className="p-3 text-muted-foreground">{projects[r.project_id] ?? "—"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={URGENCY_CLASS[r.urgency] ?? ""}>
                          {r.urgency === "urgent" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {r.urgency}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={statusCfg.class}>{statusCfg.label}</Badge>
                        {r.is_over_budget && <Badge variant="outline" className="ml-1 bg-destructive/10 text-destructive text-[10px]">Over Budget</Badge>}
                      </td>
                      {canApprove && (
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {r.status === "pending_budget" && (userRole === "costing_engineer" || userRole === "super_admin" || userRole === "managing_director") && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "approve_budget")}>Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "over_budget")}>Over Budget</Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleAction(r.id, "reject")}>Reject</Button>
                              </>
                            )}
                            {r.status === "pending_director_approval" && (userRole === "managing_director" || userRole === "finance_director" || userRole === "super_admin") && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "director_approve")}>Approve</Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleAction(r.id, "reject")}>Reject</Button>
                              </>
                            )}
                            {r.status === "pending_po" && (userRole === "procurement" || userRole === "super_admin" || userRole === "managing_director") && (
                              <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "raise_po")}>Raise PO</Button>
                            )}
                            {r.status === "po_raised" && (userRole === "stores_executive" || userRole === "super_admin" || userRole === "managing_director") && (
                              <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "mark_received")}>Mark Received</Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewMaterialRequestDialog open={addOpen} onOpenChange={setAddOpen} onCreated={fetchData} />
    </div>
  );
}
