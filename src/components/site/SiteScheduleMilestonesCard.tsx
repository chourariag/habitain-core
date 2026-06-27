import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { CalendarRange } from "lucide-react";

interface Props { projectId: string }

export function SiteScheduleMilestonesCard({ projectId }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ss } = await supabase.from("site_schedules" as any).select("*").eq("project_id", projectId).maybeSingle();
      setData(ss);
      setLoaded(true);
    })();
  }, [projectId]);

  if (!loaded || !data) return null;
  const milestones: any[] = data.installation_milestones || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarRange className="h-4 w-4" /> Site Schedule Milestones</CardTitle>
        <Badge className={data.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
          {String(data.status).replace("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Milestone</TableHead>
                <TableHead>Planned Date</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((m, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{m.milestone_name}</TableCell>
                  <TableCell>{m.planned_date ? format(parseISO(m.planned_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.notes ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
