import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const ALLOWED = ["super_admin", "managing_director", "finance_manager"];

type LogRow = {
  id: string;
  data_type: string;
  company_name: string | null;
  batch_id: string;
  record_count: number;
  status: "success" | "failed" | "duplicate";
  error_message: string | null;
  received_at: string;
  sync_timestamp: string | null;
};

const statusColor: Record<string, string> = {
  success: "#006039",
  failed: "#F40009",
  duplicate: "#D4860A",
};

export function TallyIncomingSyncLogTab() {
  const { role } = useUserRole();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tally_ingest_log" as never)
      .select("*")
      .order("received_at", { ascending: false })
      .limit(500);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (!role || !ALLOWED.includes(role)) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        You do not have access to the Tally Incoming Sync Log.
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle style={{ color: "#1A1A1A" }}>Tally Incoming Sync Log</CardTitle>
          <p className="text-xs mt-1" style={{ color: "#666" }}>
            Every push from Tally into HStack, newest first.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">Received</th>
                <th className="px-3 py-2 font-medium">Data Type</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Batch ID</th>
                <th className="px-3 py-2 font-medium text-right">Records</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No incoming syncs yet.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.received_at).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2">{r.data_type}</td>
                  <td className="px-3 py-2">{r.company_name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.batch_id}</td>
                  <td className="px-3 py-2 text-right">{r.record_count}</td>
                  <td className="px-3 py-2">
                    <Badge style={{ backgroundColor: statusColor[r.status], color: "#fff" }}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-red-600 max-w-xs truncate">{r.error_message ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
