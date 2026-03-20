import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Pin, Plus, Loader2, CheckSquare, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { AppRole } from "@/lib/roles";
import { useAuth } from "@/components/AuthProvider";

const CAN_POST: AppRole[] = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];

interface Props {
  userRole: AppRole | null;
}

export function SharedDashboardBottom({ userRole }: Props) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const canPost = userRole ? CAN_POST.includes(userRole) : false;

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_archived", false)
      .order("pinned", { ascending: false })
      .order("posted_at", { ascending: false })
      .limit(3);
    setAnnouncements(data ?? []);
    setLoading(false);
  };

  const handlePost = async () => {
    if (!title.trim() || !body.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim(),
      posted_by: user.id,
    });
    if (error) {
      toast.error("Failed to post announcement");
    } else {
      toast.success("Announcement posted");
      setTitle("");
      setBody("");
      setOpen(false);
      fetchAnnouncements();
    }
    setPosting(false);
  };

  return (
    <>
      {/* Announcements */}
      <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold flex items-center gap-2" style={{ color: "#1A1A1A" }}>
            <Megaphone className="h-4 w-4" style={{ color: "#006039" }} /> Announcements
          </h2>
          {canPost && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Post
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <Textarea placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
                  <Button onClick={handlePost} disabled={posting || !title.trim() || !body.trim()} className="w-full">
                    {posting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Post Announcement
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "#666666" }}>No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-md border border-border p-3" style={{ backgroundColor: a.pinned ? "#E8F2ED" : "#F7F7F7" }}>
                <div className="flex items-center gap-2 mb-1">
                  {a.pinned && <Pin className="h-3 w-3" style={{ color: "#006039" }} />}
                  <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{a.title}</span>
                </div>
                <p className="text-sm" style={{ color: "#666666" }}>{a.body}</p>
                <p className="text-[10px] mt-2" style={{ color: "#999999" }}>
                  {formatDistanceToNow(new Date(a.posted_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Tasks placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h2 className="font-display text-base font-semibold flex items-center gap-2 mb-3" style={{ color: "#1A1A1A" }}>
            <CheckSquare className="h-4 w-4" style={{ color: "#006039" }} /> My Tasks
          </h2>
          <p className="text-sm" style={{ color: "#999999" }}>Task integration coming in Phase 5.</p>
        </div>

        {/* Weekly KPI placeholder — hidden for architects and hr */}
        {userRole && !["principal_architect", "project_architect", "structural_architect", "hr_executive"].includes(userRole) && (
          <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h2 className="font-display text-base font-semibold flex items-center gap-2 mb-3" style={{ color: "#1A1A1A" }}>
              <Trophy className="h-4 w-4" style={{ color: "#006039" }} /> Weekly KPI Score
            </h2>
            <p className="text-sm" style={{ color: "#999999" }}>KPI module coming in Phase 4E.</p>
          </div>
        )}
      </div>
    </>
  );
}
