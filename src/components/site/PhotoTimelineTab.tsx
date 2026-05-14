import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Props { projectId: string; }

export function PhotoTimelineTab({ projectId }: Props) {
  const [positions, setPositions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("photo_positions") as any).select("*").eq("project_id", projectId).eq("is_active", true).order("position_number");
      setPositions(data ?? []);
      if ((data ?? []).length > 0) setSelected(data[0].id);
      setLoading(false);
    })();
  }, [projectId]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const { data } = await (supabase.from("site_position_photos") as any)
        .select("*").eq("position_id", selected).order("photo_date", { ascending: true });
      setPhotos(data ?? []);
    })();
  }, [selected]);

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (positions.length === 0) return <p className="text-sm text-muted-foreground">No positions defined yet.</p>;

  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger><SelectValue placeholder="Choose position" /></SelectTrigger>
          <SelectContent>
            {positions.map((p) => <SelectItem key={p.id} value={p.id}>#{p.position_number} {p.area_name} ({p.floor_name})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground">No photos yet for this position.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-3 pb-2">
            {photos.map((ph) => (
              <Card key={ph.id} className="shrink-0 w-48">
                <CardContent className="p-2 space-y-1">
                  <img src={ph.file_url} className="h-32 w-full object-cover rounded" alt={ph.photo_date} />
                  <div className="text-xs font-medium">{format(new Date(ph.photo_date), "dd/MM/yyyy")}</div>
                  {ph.ai_severity && ph.ai_severity !== "info" && (
                    <Badge variant={ph.ai_severity === "major" ? "destructive" : "outline"} className="text-[10px]">
                      <AlertTriangle className="h-3 w-3 mr-1" />{ph.ai_severity}
                    </Badge>
                  )}
                  {(ph.ai_flags ?? []).slice(0, 2).map((f: string, i: number) => (
                    <p key={i} className="text-[10px] text-muted-foreground line-clamp-2">{f}</p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
