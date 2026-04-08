import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, CheckCircle2, AlertTriangle, Camera, ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  userRole: string | null;
}

const CATEGORIES = ["cosmetic", "functional", "structural"];
const PARTIES = ["Habitainer Team", "Client", "Subcontractor"];

function generatePunchListId(existingIds: string[]): string {
  const today = format(new Date(), "yyyyMMdd");
  const prefix = `PL-${today}-`;
  const existing = existingIds.filter(id => id.startsWith(prefix));
  const maxSeq = existing.reduce((max, id) => {
    const seq = parseInt(id.replace(prefix, ""), 10);
    return isNaN(seq) ? max : Math.max(max, seq);
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export function PunchListModule({ projectId, userRole }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  // Quick-add form
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("cosmetic");
  const [responsibleParty, setResponsibleParty] = useState("Habitainer Team");
  const [targetDate, setTargetDate] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Close item state
  const [closingId, setClosingId] = useState<string | null>(null);
  const [fixDesc, setFixDesc] = useState("");
  const [afterPhotoFile, setAfterPhotoFile] = useState<File | null>(null);

  // Waive state
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  const canManage = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? "");
  const canView = canManage || ["director", "finance_director", "sales_director", "architecture_director", "head_operations", "production_head"].includes(userRole ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("punch_list_items") as any)
      .select("*").eq("project_id", projectId).order("created_at", { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const uploadPhoto = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${projectId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("site-photos").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("site-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAdd = async () => {
    if (!description.trim()) { toast.error("Description is required"); return; }
    if (!photoFile) { toast.error("At least 1 photo is required"); return; }
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const photoUrl = await uploadPhoto(photoFile, "punch-list");
      const existingPLIds = items.map(i => i.punch_list_id);
      const punchListId = items.length > 0 ? items[0].punch_list_id : generatePunchListId(existingPLIds);

      const { client } = await getAuthedClient();
      await (client.from("punch_list_items") as any).insert({
        punch_list_id: punchListId,
        project_id: projectId,
        description: description.trim(),
        location: location.trim() || null,
        category,
        before_photo_url: photoUrl,
        responsible_party: responsibleParty,
        target_close_date: targetDate || null,
        created_by: user.id,
      });
      toast.success("Punch list item added");
      setDescription(""); setLocation(""); setCategory("cosmetic"); setResponsibleParty("Habitainer Team"); setTargetDate(""); setPhotoFile(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleClose = async (id: string) => {
    if (!fixDesc.trim()) { toast.error("Fix description required"); return; }
    if (!afterPhotoFile) { toast.error("After photo required"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const afterUrl = await uploadPhoto(afterPhotoFile, "punch-list-after");
      const { client } = await getAuthedClient();
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("auth_user_id", user!.id).single();
      await (client.from("punch_list_items") as any).update({
        status: "closed",
        fix_description: fixDesc.trim(),
        after_photo_url: afterUrl,
        closed_by: profile?.display_name ?? user!.email,
        closed_at: new Date().toISOString(),
      }).eq("id", id);
      toast.success("Item closed");
      setClosingId(null); setFixDesc(""); setAfterPhotoFile(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to close");
    }
  };

  const handleWaive = async (id: string) => {
    if (!waiveReason.trim()) { toast.error("Waive reason required"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("auth_user_id", user!.id).single();
      const { client } = await getAuthedClient();
      await (client.from("punch_list_items") as any).update({
        status: "waived",
        waived: true,
        waive_reason: `Waived by ${profile?.display_name ?? "Manager"}: ${waiveReason.trim()}`,
      }).eq("id", id);
      toast.success("Item waived");
      setWaivingId(null); setWaiveReason("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to waive");
    }
  };

  if (!canView) return null;

  const openCount = items.filter(i => i.status === "open").length;
  const closedCount = items.filter(i => i.status === "closed").length;
  const waivedCount = items.filter(i => i.status === "waived").length;
  const allResolved = items.length > 0 && openCount === 0;

  const categoryColor = (cat: string) => {
    switch (cat) {
      case "structural": return { bg: "#FDE8E8", color: "#F40009" };
      case "functional": return { bg: "#FFF8E8", color: "#D4860A" };
      default: return { bg: "#F7F7F7", color: "#666666" };
    }
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "closed": return { bg: "#E8F2ED", color: "#006039" };
      case "waived": return { bg: "#FFF8E8", color: "#D4860A" };
      default: return { bg: "#FDE8E8", color: "#F40009" };
    }
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#1A1A1A" }}>
          <ClipboardList className="h-4 w-4" style={{ color: "#006039" }} />
          Punch List
          {items.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              {items[0].punch_list_id}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <div className="flex gap-1.5 text-[10px]">
              <Badge variant="outline" style={{ backgroundColor: "#FDE8E8", color: "#F40009", border: "none" }}>{openCount} Open</Badge>
              <Badge variant="outline" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>{closedCount} Closed</Badge>
              {waivedCount > 0 && <Badge variant="outline" style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}>{waivedCount} Waived</Badge>}
            </div>
          )}
          {canManage && (
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="text-xs h-7 gap-1">
              <Plus className="h-3 w-3" /> Add Item
            </Button>
          )}
        </div>
      </div>

      {allResolved && (
        <div className="flex items-center gap-2 p-3 rounded-md" style={{ backgroundColor: "#E8F2ED" }}>
          <CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} />
          <p className="text-xs font-medium" style={{ color: "#006039" }}>All punch list items resolved. Handover certificate can be generated.</p>
        </div>
      )}

      {/* Quick-add form — optimized for mobile walkthrough */}
      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Textarea placeholder="Description *" value={description} onChange={e => setDescription(e.target.value)} className="text-sm min-h-[60px]" />
            <Input placeholder="Location (e.g. Bedroom 2 — north wall)" value={location} onChange={e => setLocation(e.target.value)} className="text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={responsibleParty} onValueChange={setResponsibleParty}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Target close date</label>
                <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Photo *</label>
                <label className="flex items-center gap-1.5 cursor-pointer border rounded-md px-3 py-2 text-sm hover:bg-muted/50">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  {photoFile ? photoFile.name.slice(0, 20) : "Capture / Upload"}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={adding}>
                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add Item"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">No punch list items yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const catStyle = categoryColor(item.category);
            const stStyle = statusStyle(item.status);
            return (
              <Card key={item.id}>
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{item.description}</p>
                        <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: catStyle.bg, color: catStyle.color, border: "none" }}>
                          {item.category}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: stStyle.bg, color: stStyle.color, border: "none" }}>
                          {item.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-1" style={{ color: "#666666" }}>
                        {item.location && <span>📍 {item.location}</span>}
                        <span>👤 {item.responsible_party}</span>
                        {item.target_close_date && <span>Due: {format(new Date(item.target_close_date), "dd/MM/yyyy")}</span>}
                      </div>
                    </div>
                    {item.before_photo_url && (
                      <img src={item.before_photo_url} alt="Before" className="h-12 w-12 rounded object-cover shrink-0" />
                    )}
                  </div>

                  {/* Closed info */}
                  {item.status === "closed" && (
                    <div className="text-xs p-2 rounded" style={{ backgroundColor: "#F7F7F7", color: "#666666" }}>
                      <span className="font-medium">Fix:</span> {item.fix_description} — {item.closed_by}, {item.closed_at && format(new Date(item.closed_at), "dd/MM/yyyy")}
                      {item.after_photo_url && <img src={item.after_photo_url} alt="After" className="h-10 w-10 rounded object-cover mt-1" />}
                    </div>
                  )}

                  {item.status === "waived" && (
                    <div className="text-xs p-2 rounded" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
                      {item.waive_reason}
                    </div>
                  )}

                  {/* Close form */}
                  {closingId === item.id && (
                    <div className="space-y-2 p-2 border rounded">
                      <Textarea placeholder="Fix description *" value={fixDesc} onChange={e => setFixDesc(e.target.value)} className="text-sm min-h-[50px]" />
                      <label className="flex items-center gap-1.5 cursor-pointer border rounded-md px-3 py-2 text-sm">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        {afterPhotoFile ? afterPhotoFile.name.slice(0, 20) : "After photo *"}
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setAfterPhotoFile(e.target.files?.[0] ?? null)} />
                      </label>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setClosingId(null)}>Cancel</Button>
                        <Button size="sm" onClick={() => handleClose(item.id)}>Close Item</Button>
                      </div>
                    </div>
                  )}

                  {/* Waive form */}
                  {waivingId === item.id && (
                    <div className="space-y-2 p-2 border rounded">
                      <Textarea placeholder="Reason for waiver *" value={waiveReason} onChange={e => setWaiveReason(e.target.value)} className="text-sm min-h-[50px]" />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setWaivingId(null)}>Cancel</Button>
                        <Button size="sm" variant="outline" onClick={() => handleWaive(item.id)}>Waive Item</Button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {item.status === "open" && canManage && closingId !== item.id && waivingId !== item.id && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => { setClosingId(item.id); setWaivingId(null); }}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Close
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-6" style={{ color: "#D4860A" }} onClick={() => { setWaivingId(item.id); setClosingId(null); }}>
                        <X className="h-3 w-3 mr-1" /> Waive
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
