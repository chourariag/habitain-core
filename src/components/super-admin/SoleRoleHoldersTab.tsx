import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roles";

type SoleRoleHolder = {
  role: string;
  role_label: string;
  holder_profile_id: string;
  holder_name: string;
  holder_email: string;
};

export function SoleRoleHoldersTab() {
  const { data: holders, isLoading } = useQuery({
    queryKey: ["sole-role-holders"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sole_role_holders");
      if (error) throw error;
      return (data as SoleRoleHolder[]) || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border p-4" style={{ background: "#FEF3C7", borderColor: "#FCD34D" }}>
        <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "#92400E" }} />
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: "#92400E" }}>Concentration risk</p>
          <p className="text-sm" style={{ color: "#92400E" }}>
            These roles are currently held by exactly one active profile. If that person leaves or is unavailable,
            no one else can cover the role until a replacement is assigned.
          </p>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow style={{ backgroundColor: "#F7F7F7" }}>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Role</TableHead>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Holder</TableHead>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holders && holders.length > 0 ? (
              holders.map((h) => (
                <TableRow key={`${h.role}-${h.holder_profile_id}`}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {ROLE_LABELS[h.role] || h.role_label || h.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{h.holder_name || "—"}</TableCell>
                  <TableCell className="text-xs" style={{ color: "#666" }}>{h.holder_email || "—"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-sm" style={{ color: "#999" }}>
                  No sole role holders — every active role has backup coverage.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
