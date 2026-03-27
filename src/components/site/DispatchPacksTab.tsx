import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, ArrowLeft, Package } from "lucide-react";
import { format } from "date-fns";

interface DispatchPack {
  id: string;
  dispatch_pack_id: string;
  dispatch_date: string;
  vehicle_type: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  transporter_name: string | null;
  site_installation_manager_id: string | null;
  team_member_ids: string[];
  supervisor_accompanying: boolean;
  loading_checklist_complete: boolean;
  notes: string | null;
  status: string;
  created_at: string;
}

interface MaterialLogItem {
  material_name: string;
  unit: string | null;
  qty_dispatched: number;
  note: string | null;
}

interface Props {
  projectId: string;
}

export function DispatchPacksTab({ projectId }: Props) {
  const [packs, setPacks] = useState<DispatchPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<DispatchPack | null>(null);
  const [materialLog, setMaterialLog] = useState<MaterialLogItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>([]);

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("dispatch_packs") as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setPacks(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchPacks(); }, [fetchPacks]);

  const openDetail = async (pack: DispatchPack) => {
    setSelectedPack(pack);
    setLoadingDetail(true);

    const [matRes, mgrRes, teamRes] = await Promise.all([
      (supabase.from("dispatch_material_log") as any)
        .select("material_name,unit,qty_dispatched,note")
        .eq("dispatch_pack_id", pack.dispatch_pack_id),
      pack.site_installation_manager_id
        ? supabase.from("profiles").select("display_name").eq("auth_user_id", pack.site_installation_manager_id).single()
        : Promise.resolve({ data: null }),
      (pack.team_member_ids?.length)
        ? supabase.from("profiles").select("auth_user_id,display_name").in("auth_user_id", pack.team_member_ids)
        : Promise.resolve({ data: [] }),
    ]);

    setMaterialLog(matRes.data ?? []);
    setManagerName((mgrRes.data as any)?.display_name ?? null);
    setTeamNames(((teamRes.data ?? []) as any[]).map((p) => p.display_name || "Unknown"));
    setLoadingDetail(false);
  };

  if (selectedPack) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedPack(null)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>

        <div className="rounded-lg border p-4 space-y-4" style={{ backgroundColor: "#F7F7F7" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-display font-bold text-lg" style={{ color: "#1A1A1A" }}>
                {selectedPack.dispatch_pack_id}
              </h3>
              <p className="text-xs" style={{ color: "#666" }}>
                {format(new Date(selectedPack.dispatch_date), "dd/MM/yyyy")}
              </p>
            </div>
            <Badge variant="outline" className="gap-1" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>
              <Lock className="h-3 w-3" /> Submitted
            </Badge>
          </div>

          {loadingDetail ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Vehicle */}
              <div>
                <p className="text-xs font-bold uppercase mb-1" style={{ color: "#006039" }}>Vehicle Details</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span style={{ color: "#666" }}>Type:</span> {selectedPack.vehicle_type}</div>
                  <div><span style={{ color: "#666" }}>Number:</span> {selectedPack.vehicle_number}</div>
                  <div><span style={{ color: "#666" }}>Driver:</span> {selectedPack.driver_name}</div>
                  <div><span style={{ color: "#666" }}>Phone:</span> {selectedPack.driver_phone}</div>
                  {selectedPack.transporter_name && (
                    <div className="col-span-2"><span style={{ color: "#666" }}>Transporter:</span> {selectedPack.transporter_name}</div>
                  )}
                </div>
              </div>

              {/* Team */}
              <div>
                <p className="text-xs font-bold uppercase mb-1" style={{ color: "#006039" }}>Team</p>
                <div className="text-sm space-y-1">
                  {managerName && <div><span style={{ color: "#666" }}>Site Manager:</span> {managerName}</div>}
                  {teamNames.length > 0 && <div><span style={{ color: "#666" }}>Members:</span> {teamNames.join(", ")}</div>}
                  <div><span style={{ color: "#666" }}>Supervisor Accompanying:</span> {selectedPack.supervisor_accompanying ? "Yes" : "No"}</div>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <p className="text-xs font-bold uppercase mb-1" style={{ color: "#006039" }}>Loading Checklist</p>
                <Badge variant="outline" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>
                  All Items Verified ✅
                </Badge>
              </div>

              {/* Materials */}
              {materialLog.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase mb-1" style={{ color: "#006039" }}>Materials Dispatched</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs" style={{ color: "#666" }}>
                          <th className="pb-1">Material</th>
                          <th className="pb-1">Unit</th>
                          <th className="pb-1 text-right">Qty</th>
                          <th className="pb-1">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialLog.map((m, i) => (
                          <tr key={i} className="border-t">
                            <td className="py-1.5">{m.material_name}</td>
                            <td className="py-1.5" style={{ color: "#666" }}>{m.unit}</td>
                            <td className="py-1.5 text-right font-medium">{m.qty_dispatched}</td>
                            <td className="py-1.5 text-xs" style={{ color: "#666" }}>{m.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedPack.notes && (
                <div>
                  <p className="text-xs font-bold uppercase mb-1" style={{ color: "#006039" }}>Notes</p>
                  <p className="text-sm" style={{ color: "#1A1A1A" }}>{selectedPack.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (packs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No dispatch packs created yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {packs.map((pack) => (
        <button
          key={pack.id}
          onClick={() => openDetail(pack)}
          className="w-full text-left rounded-lg border p-3 hover:shadow-sm transition-shadow bg-card"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold" style={{ color: "#006039" }}>
                {pack.dispatch_pack_id}
              </span>
              <span className="text-xs" style={{ color: "#666" }}>
                {format(new Date(pack.dispatch_date), "dd/MM/yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pack.vehicle_number && (
                <span className="text-xs" style={{ color: "#666" }}>{pack.vehicle_number}</span>
              )}
              <Badge variant="outline" className="gap-1 text-xs" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>
                <Lock className="h-2.5 w-2.5" /> Submitted
              </Badge>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
