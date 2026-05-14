import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props { userId: string; }

export function MdNotePanel({ userId }: Props) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const isMd = role === "managing_director" || role === "super_admin";
  const month = new Date(); month.setDate(1);
  const monthStr = month.toISOString().slice(0, 10);

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("kpi_md_notes")
      .select("note").eq("user_id", userId).eq("month", monthStr).maybeSingle();
    setNote(data?.note ?? "");
    setLoading(false);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("kpi_md_notes").upsert({
      user_id: userId, month: monthStr, note: note.trim(), written_by: user.id,
    }, { onConflict: "user_id,month" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Note saved");
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-lg border border-border p-4 bg-background space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" style={{ color: "#006039" }} />
        MD Contextual Note · {month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
      </div>
      {isMd ? (
        <>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Context not captured by data — e.g. 'Azad managed a crisis this week'"
            rows={3}
            className="text-sm"
          />
          <Button onClick={save} disabled={saving} size="sm" style={{ backgroundColor: "#006039", color: "white" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Note
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">{note || "No note for this month."}</p>
      )}
    </div>
  );
}
