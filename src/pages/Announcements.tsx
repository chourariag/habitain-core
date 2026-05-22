import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Megaphone, Pin, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const MANAGE_ROLES = [
  "super_admin", "managing_director", "finance_director",
  "sales_director", "architecture_director", "head_operations",
];

interface Announcement {
  id: string;
  title: string;
  body: string;
  posted_by: string;
  posted_at: string;
  pinned: boolean;
  is_archived: boolean;
}

export default function Announcements() {
  const { session } = useAuth();
  const { role } = useUserRole();
  const canManage = role ? MANAGE_ROLES.includes(role) : false;

  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("announcements") as any)
      .select("*")
      .eq("is_archived", false)
      .order("pinned", { ascending: false })
      .order("posted_at", { ascending: false });
    if (error) toast.error(`Failed to load: ${error.message}`);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handlePost = async () => {
    const userId = session?.user?.id;
    if (!userId) { toast.error("Not signed in"); return; }
    if (title.trim().length < 3 || body.trim().length < 5) {
      toast.error("Title and body are required");
      return;
    }
    setPosting(true);
    const { error } = await (supabase.from("announcements") as any).insert({
      title: title.trim(),
      body: body.trim(),
      pinned,
      posted_by: userId,
    });
    if (error) {
      toast.error(`Post failed: ${error.message}`);
    } else {
      toast.success("Announcement posted");
      setTitle(""); setBody(""); setPinned(false); setShowForm(false);
      fetchRows();
    }
    setPosting(false);
  };

  const togglePin = async (a: Announcement) => {
    const { error } = await (supabase.from("announcements") as any)
      .update({ pinned: !a.pinned })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else fetchRows();
  };

  const archive = async (a: Announcement) => {
    if (!confirm("Archive this announcement?")) return;
    const { error } = await (supabase.from("announcements") as any)
      .update({ is_archived: true })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else { toast.success("Archived"); fetchRows(); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4" style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6" style={{ color: "#006039" }} />
          <h1 className="font-display text-xl md:text-2xl font-bold" style={{ color: "#1A1A1A" }}>
            Announcements
          </h1>
        </div>
        {canManage && !showForm && (
          <Button onClick={() => setShowForm(true)} style={{ background: "#006039", color: "#fff" }}>
            <Plus className="h-4 w-4 mr-1" /> New Announcement
          </Button>
        )}
      </div>

      {canManage && showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">New Announcement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <Textarea
              placeholder="Body — keep it brief and actionable"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(!!v)} />
              <Pin className="h-3.5 w-3.5" /> Pin to top
            </label>
            <div className="flex gap-2">
              <Button onClick={handlePost} disabled={posting} style={{ background: "#006039", color: "#fff" }}>
                {posting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Post
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setTitle(""); setBody(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id} className={a.pinned ? "border-[#006039]/40" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && (
                      <Badge style={{ background: "#006039", color: "#fff" }} className="gap-1">
                        <Pin className="h-3 w-3" /> Pinned
                      </Badge>
                    )}
                    <CardTitle className="text-base font-display">{a.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(a.posted_at), "dd/MM/yyyy HH:mm")}
                    </span>
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => togglePin(a)} title="Toggle pin">
                          <Pin className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => archive(a)} title="Archive">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#333" }}>
                  {a.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
