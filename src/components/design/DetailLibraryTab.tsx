import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { STANDARD_DETAILS } from "@/lib/design-checklist-data";

const STATUSES = ["Not Started", "In Progress", "Complete", "Not Applicable"] as const;

const statusStyle = (s: string): React.CSSProperties => {
  switch (s) {
    case "Complete": return { backgroundColor: "#E8F2ED", color: "#006039" };
    case "In Progress": return { backgroundColor: "#FFF8E8", color: "#D4860A" };
    case "Not Applicable": return { color: "#666666", textDecoration: "line-through" };
    default: return { backgroundColor: "#F5F5F5", color: "#666666" };
  }
};

interface Props {
  projectId: string;
  isArchitect: boolean;
  userId: string | null;
  userName: string;
  onStatsChange: (stats: { complete: number; inProgress: number; notStarted: number; na: number; total: number }) => void;
}

export function DetailLibraryTab({ projectId, isArchitect, userId, userName, onStatsChange }: Props) {
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDetails = useCallback(async () => {
    const { data } = await (supabase.from("design_detail_library") as any)
      .select("*")
      .eq("project_id", projectId)
      .order("detail_number");
    setDetails(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  // Auto-seed if empty
  useEffect(() => {
    if (!loading && details.length === 0) {
      seedDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, details.length]);

  const seedDetails = async () => {
    const rows = STANDARD_DETAILS.map((name, idx) => ({
      project_id: projectId,
      detail_number: idx + 1,
      detail_name: name,
      status: "Not Started",
    }));
    const { client } = await getAuthedClient();
    await (client.from("design_detail_library") as any).insert(rows);
    await fetchDetails();
  };

  // Emit stats to parent
  useEffect(() => {
    const complete = details.filter((d) => d.status === "Complete").length;
    const inProgress = details.filter((d) => d.status === "In Progress").length;
    const na = details.filter((d) => d.status === "Not Applicable").length;
    const notStarted = details.filter((d) => d.status === "Not Started").length;
    onStatsChange({ complete, inProgress, notStarted, na, total: STANDARD_DETAILS.length });
  }, [details, onStatsChange]);

  const handleUpdateStatus = async (detail: any, newStatus: string) => {
    const { client } = await getAuthedClient();
    await (client.from("design_detail_library") as any).update({
      status: newStatus,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq("id", detail.id);
    setDetails((prev) => prev.map((d) => d.id === detail.id ? { ...d, status: newStatus, updated_by: userId, updated_at: new Date().toISOString() } : d));
  };

  const handleUpdateReference = async (detail: any, ref: string) => {
    const { client } = await getAuthedClient();
    await (client.from("design_detail_library") as any).update({
      drawing_reference: ref,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq("id", detail.id);
    setDetails((prev) => prev.map((d) => d.id === detail.id ? { ...d, drawing_reference: ref } : d));
  };

  const handleMarkAllNA = async () => {
    const notStartedItems = details.filter((d) => d.status === "Not Started");
    if (notStartedItems.length === 0) return;
    const { client } = await getAuthedClient();
    const ids = notStartedItems.map((d) => d.id);
    await (client.from("design_detail_library") as any).update({
      status: "Not Applicable",
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).in("id", ids);
    setDetails((prev) => prev.map((d) => ids.includes(d.id) ? { ...d, status: "Not Applicable" } : d));
    toast.success(`${notStartedItems.length} items marked as Not Applicable`);
  };

  const stats = {
    complete: details.filter((d) => d.status === "Complete").length,
    inProgress: details.filter((d) => d.status === "In Progress").length,
    notStarted: details.filter((d) => d.status === "Not Started").length,
    na: details.filter((d) => d.status === "Not Applicable").length,
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Complete", count: stats.complete, color: "#006039", bg: "#E8F2ED" },
          { label: "In Progress", count: stats.inProgress, color: "#D4860A", bg: "#FFF8E8" },
          { label: "Not Started", count: stats.notStarted, color: "#666666", bg: "#F5F5F5" },
          { label: "Not Applicable", count: stats.na, color: "#666666", bg: "#F5F5F5" },
        ].map((t) => (
          <div key={t.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: t.bg }}>
            <p className="text-xl font-bold" style={{ color: t.color }}>{t.count}</p>
            <p className="text-[10px] uppercase font-display font-medium" style={{ color: t.color }}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* Mark All N/A button */}
      {isArchitect && stats.notStarted > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">Mark All Not Started as N/A</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark all Not Started as Not Applicable?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark {stats.notStarted} items as Not Applicable. You can change them back individually.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleMarkAllNA}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Detail register */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Standard Detail Register</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-10">#</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground min-w-[180px]">Detail Name</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-36">Status</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-32">Drawing Ref</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-24">Updated</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d: any) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-2 text-xs text-muted-foreground">{d.detail_number}</td>
                    <td className="py-2 px-2 text-[13px]" style={d.status === "Not Applicable" ? { textDecoration: "line-through", color: "#999" } : { color: "#1A1A1A" }}>
                      {d.detail_name}
                    </td>
                    <td className="py-2 px-2">
                      {isArchitect ? (
                        <Select value={d.status} onValueChange={(v) => handleUpdateStatus(d, v)}>
                          <SelectTrigger className="h-7 text-xs w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-[10px]" style={statusStyle(d.status)}>{d.status}</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {isArchitect ? (
                        <Input
                          className="h-7 text-xs w-28"
                          value={d.drawing_reference || ""}
                          placeholder="e.g. DT-001"
                          onBlur={(e) => {
                            if (e.target.value !== (d.drawing_reference || "")) {
                              handleUpdateReference(d, e.target.value);
                            }
                          }}
                          onChange={(e) => {
                            setDetails((prev) => prev.map((item) => item.id === d.id ? { ...item, drawing_reference: e.target.value } : item));
                          }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{d.drawing_reference || "—"}</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {d.updated_at ? (
                        <span className="text-[10px] text-muted-foreground">{format(new Date(d.updated_at), "dd MMM")}</span>
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
