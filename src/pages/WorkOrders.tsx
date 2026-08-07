import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, FileSignature } from "lucide-react";
import { ClientWorkOrderDialog } from "@/components/work-orders/ClientWorkOrderDialog";
import { ClientWorkOrderSummary } from "@/components/work-orders/ClientWorkOrderSummary";
import { listClientWorkOrders, inr, type ClientWorkOrder } from "@/lib/contractor-wo";
import { useUserRole } from "@/hooks/useUserRole";

const MANAGE_ROLES = [
  "super_admin", "managing_director", "chairman", "finance_director",
  "sales_director", "finance_manager", "planning_head", "head_of_projects",
];

export default function WorkOrders() {
  const { role } = useUserRole();
  const canManage = !!role && MANAGE_ROLES.includes(role);
  const [wos, setWos] = useState<ClientWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientWorkOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientWorkOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await listClientWorkOrders();
    setWos(rows);
    setSelected((prev) => (prev ? rows.find((r) => r.id === prev.id) ?? null : rows[0] ?? null));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Contractor Work Orders</h1>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>
            Client-issued Work Orders to ALTREE — shared commercial terms across all linked unit projects
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Work Order
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : wos.length === 0 ? (
        <Card className="p-8 text-center">
          <FileSignature className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No Work Orders yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {wos.map((w) => (
              <button key={w.id} onClick={() => setSelected(w)}
                className="w-full text-left rounded-md border p-3 transition-colors"
                style={{ borderColor: selected?.id === w.id ? "#006039" : undefined, backgroundColor: selected?.id === w.id ? "#F7F7F7" : undefined }}>
                <p className="text-sm font-bold">{w.wo_number}</p>
                <p className="text-xs text-muted-foreground truncate">{w.client_company_name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-bold tabular-nums" style={{ color: "#006039" }}>{inr(w.grand_total)}</span>
                  {!w.acceptance_signed && (
                    <Badge className="text-[9px] px-1.5 py-0 border-0" style={{ backgroundColor: "#F4000920", color: "#F40009" }}>
                      Acceptance pending
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div>
            {selected && (
              <ClientWorkOrderSummary
                key={selected.id}
                workOrder={selected}
                onEdit={() => { setEditing(selected); setDialogOpen(true); }}
                onChanged={load}
              />
            )}
          </div>
        </div>
      )}

      <ClientWorkOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} workOrder={editing} onSaved={load} />
    </div>
  );
}
