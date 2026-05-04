import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Entry = {
  id: string; changed_by: string | null; changed_at: string;
  section: string; action: string; entity: string | null;
  previous_value: unknown; new_value: unknown; summary: string | null;
};

export function AuditTrailTab() {
  const { data } = useQuery({
    queryKey: ["super-admin-audit"],
    queryFn: async () => {
      const { data } = await supabase.from("super_admin_audit_log" as never)
        .select("*").order("changed_at", { ascending: false }).limit(200);
      return (data as unknown as Entry[]) || [];
    },
  });

  return (
    <div className="bg-card rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>When</TableHead><TableHead>Section</TableHead><TableHead>Action</TableHead>
          <TableHead>Entity</TableHead><TableHead>Summary</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(data || []).map(e => (
            <TableRow key={e.id}>
              <TableCell className="text-xs whitespace-nowrap">{new Date(e.changed_at).toLocaleString("en-GB")}</TableCell>
              <TableCell className="text-xs">{e.section}</TableCell>
              <TableCell className="text-xs">{e.action}</TableCell>
              <TableCell className="text-xs max-w-[200px] truncate">{e.entity || "—"}</TableCell>
              <TableCell className="text-xs max-w-[400px] truncate">{e.summary || ""}</TableCell>
            </TableRow>
          ))}
          {!(data || []).length && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">No audit entries yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
