import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown, Loader2, Lock, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { insertNotifications } from "@/lib/notifications";
import { toast } from "sonner";
import { format } from "date-fns";
import { QC_CHECKLIST_SECTIONS, TOTAL_CHECKLIST_ITEMS } from "@/lib/design-checklist-data";

interface Props {
  projectId: string;
  projectName: string;
  designFile: any;
  isPrincipal: boolean;
  isArchitect: boolean;
  userId: string | null;
  userName: string;
  userRole: string | null;
  detailLibraryReady: boolean;
  detailLibraryStats: { complete: number; na: number; total: number };
  onRefresh: () => void;
}

export function MasterQCChecklist({
  projectId, projectName, designFile, isPrincipal, isArchitect,
  userId, userName, userRole, detailLibraryReady, detailLibraryStats, onRefresh,
}: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [signoffs, setSignoffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [openSections, setOpenSections] = useState<number[]>([]);
  const [noteEditing, setNoteEditing] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const isGfcIssued = designFile?.design_stage === "gfc_issued";
  const canTick = (isPrincipal || isArchitect) && !isGfcIssued;

  const fetchItems = useCallback(async () => {
    const [itemsRes, signoffsRes] = await Promise.all([
      (supabase.from("design_qc_checklist") as any)
        .select("*").eq("project_id", projectId).order("section_number").order("item_index"),
      (supabase.from("design_qc_section_signoffs") as any)
        .select("*").eq("project_id", projectId),
    ]);
    setItems(itemsRes.data ?? []);
    setSignoffs(signoffsRes.data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!loading && items.length === 0) { seedChecklist(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items.length]);

  const seedChecklist = async () => {
    const rows: any[] = [];
    QC_CHECKLIST_SECTIONS.forEach((section) => {
      section.items.forEach((text, idx) => {
        rows.push({
          project_id: projectId,
          section_number: section.number,
          section_name: section.name,
          item_index: idx,
          item_text: text,
        });
      });
    });
    const { client } = await getAuthedClient();
    await (client.from("design_qc_checklist") as any).insert(rows);
    await fetchItems();
  };

  const handleTick = async (item: any, checked: boolean) => {
    if (!canTick) return;
    const { client } = await getAuthedClient();
    await (client.from("design_qc_checklist") as any).update({
      is_ticked: checked,
      ticked_by: checked ? userId : null,
      ticked_at: checked ? new Date().toISOString() : null,
    }).eq("id", item.id);
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, is_ticked: checked, ticked_by: checked ? userId : null, ticked_at: checked ? new Date().toISOString() : null } : i)
    );
  };

  const handleSaveNote = async (item: any) => {
    const { client } = await getAuthedClient();
    await (client.from("design_qc_checklist") as any).update({ note: noteText }).eq("id", item.id);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, note: noteText } : i));
    setNoteEditing(null);
    setNoteText("");
  };

  const handleSignOffSection = async (sectionNumber: number) => {
    if (!isPrincipal && !isArchitect) return;
    try {
      const { client } = await getAuthedClient();
      await (client.from("design_qc_section_signoffs") as any).insert({
        project_id: projectId,
        section_number: sectionNumber,
        signed_by: userId,
        signed_by_name: userName,
        signed_by_role: userRole,
      });
      setSignoffs((prev) => [...prev, {
        project_id: projectId,
        section_number: sectionNumber,
        signed_by: userId,
        signed_by_name: userName,
        signed_by_role: userRole,
        signed_at: new Date().toISOString(),
      }]);
      toast.success(`Section ${sectionNumber} signed off`);
    } catch (err: any) {
      toast.error(err.message || "Sign-off failed");
    }
  };

  const getSectionSignoff = (sectionNumber: number) =>
    signoffs.find((s: any) => s.section_number === sectionNumber);

  const sections = QC_CHECKLIST_SECTIONS.map((sec) => {
    const sectionItems = items.filter((i) => i.section_number === sec.number);
    const tickedCount = sectionItems.filter((i) => i.is_ticked).length;
    const totalCount = sec.items.length;
    const pct = totalCount > 0 ? Math.round((tickedCount / totalCount) * 100) : 0;
    const signoff = getSectionSignoff(sec.number);
    return { ...sec, sectionItems, tickedCount, totalCount, pct, signoff };
  });

  const totalTicked = items.filter((i) => i.is_ticked).length;
  const totalItems = TOTAL_CHECKLIST_ITEMS;
  const totalPct = totalItems > 0 ? Math.round((totalTicked / totalItems) * 100) : 0;

  const allSectionsSigned = sections.every((s) => s.signoff);
  const allChecklistComplete = totalTicked === totalItems && items.length >= totalItems && allSectionsSigned;
  const canIssueGFC = allChecklistComplete && detailLibraryReady && isPrincipal && !isGfcIssued;

  const incompleteSections = sections.filter((s) => s.pct < 100 || !s.signoff).length;
  const remainingItems = totalItems - totalTicked;

  const handleIssueGFC = async () => {
    setIssuing(true);
    try {
      const { client } = await getAuthedClient();
      await (client.from("project_design_files") as any).update({
        design_stage: "gfc_issued",
        gfc_issued_at: new Date().toISOString(),
        gfc_issued_by: userId,
        gfc_issuer_name: userName,
      }).eq("project_id", projectId);

      const { data: prodProfiles } = await supabase.from("profiles")
        .select("auth_user_id").in("role", ["production_head", "head_operations", "managing_director"] as any[]).eq("is_active", true);

      if (prodProfiles?.length) {
        await insertNotifications(
          prodProfiles.map((p: any) => ({
            recipient_id: p.auth_user_id,
            title: "GFC Issued",
            body: `GFC issued for ${projectName} by ${userName}. Production can proceed.`,
            category: "design",
            related_table: "project",
            related_id: projectId,
            navigate_to: "/design",
          }))
        );
      }

      toast.success(`GFC issued for ${projectName}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue GFC");
    } finally {
      setIssuing(false);
    }
  };

  const toggleSection = (num: number) => {
    setOpenSections((prev) => prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-display">D — Architect QC Checklist</CardTitle>
          {isGfcIssued && <Lock className="h-4 w-4 text-muted-foreground" />}
        </div>
        {isGfcIssued && designFile?.gfc_issued_at && (
          <p className="text-xs mt-1" style={{ color: "#006039" }}>
            GFC issued on {format(new Date(designFile.gfc_issued_at), "dd MMM yyyy")} by {designFile.gfc_issuer_name || "—"}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span style={{ color: "#666666" }}>
              {totalTicked} of {totalItems} items complete · {sections.filter(s => s.signoff).length} of {sections.length} sections signed off
            </span>
            <span className="font-semibold" style={{ color: totalPct === 100 ? "#006039" : "#1A1A1A" }}>{totalPct}%</span>
          </div>
          <Progress value={totalPct} className="h-2.5" />
        </div>

        {/* Sections */}
        {sections.map((sec) => {
          const isOpen = openSections.includes(sec.number);
          const sectionComplete = sec.pct === 100;
          const sectionColor = sectionComplete ? "#006039" : sec.pct > 0 ? "#D4860A" : undefined;
          const statusLabel = sectionComplete && sec.signoff ? "Complete" : sectionComplete ? "Ready for Sign-Off" : sec.pct > 0 ? "In Progress" : "Pending";
          const statusStyle: React.CSSProperties = sectionComplete && sec.signoff
            ? { backgroundColor: "#E8F2ED", color: "#006039" }
            : sectionComplete
            ? { backgroundColor: "#FFF8E8", color: "#D4860A" }
            : sec.pct > 0
            ? { backgroundColor: "#FFF8E8", color: "#D4860A" }
            : { backgroundColor: "#F5F5F5", color: "#666666" };

          return (
            <Collapsible key={sec.number} open={isOpen} onOpenChange={() => toggleSection(sec.number)}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-border transition-colors hover:bg-muted/30"
                  style={sectionComplete && sec.signoff ? { backgroundColor: "#E8F2ED" } : undefined}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {sectionComplete && sec.signoff && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />}
                    <span className="text-sm font-semibold text-left" style={{ color: "#1A1A1A" }}>
                      {sec.number}. {sec.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]" style={statusStyle}>{statusLabel}</Badge>
                    <span className="text-xs font-medium" style={{ color: sectionColor || "#666666" }}>
                      {sec.tickedCount}/{sec.totalCount}
                    </span>
                    <div className="w-16">
                      <Progress value={sec.pct} className="h-1.5" />
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 ml-2 space-y-0.5">
                  {sec.sectionItems.map((item: any) => (
                    <div key={item.id} className="flex items-start gap-2.5 py-1.5 px-2 rounded hover:bg-muted/20">
                      <Checkbox
                        checked={item.is_ticked}
                        disabled={!canTick || !!sec.signoff}
                        onCheckedChange={(checked) => handleTick(item, !!checked)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px]" style={{ color: item.is_ticked ? "#006039" : "#1A1A1A" }}>
                          {item.item_text}
                        </span>
                        {item.is_ticked && item.ticked_at && (
                          <p className="text-[10px] mt-0.5" style={{ color: "#999999" }}>
                            Ticked {format(new Date(item.ticked_at), "dd MMM yyyy")}
                          </p>
                        )}
                        {item.note && (
                          <p className="text-[11px] mt-0.5 italic" style={{ color: "#666666" }}>
                            Note: {item.note}
                          </p>
                        )}
                        {noteEditing === item.id && (
                          <div className="flex gap-1.5 mt-1">
                            <Input
                              className="h-7 text-xs"
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Add a note…"
                            />
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveNote(item)}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNoteEditing(null)}>Cancel</Button>
                          </div>
                        )}
                      </div>
                      {canTick && !sec.signoff && noteEditing !== item.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => { setNoteEditing(item.id); setNoteText(item.note || ""); }}
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* Section Sign-Off */}
                  {sec.signoff ? (
                    <div className="mt-3 p-2.5 rounded-lg flex items-center gap-2" style={{ backgroundColor: "#E8F2ED" }}>
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />
                      <span className="text-xs" style={{ color: "#666666" }}>
                        Signed off by {sec.signoff.signed_by_name} ({sec.signoff.signed_by_role?.replace(/_/g, " ")}) on{" "}
                        {format(new Date(sec.signoff.signed_at), "dd/MM/yyyy")}
                      </span>
                    </div>
                  ) : sectionComplete && (isPrincipal || isArchitect) && !isGfcIssued ? (
                    <Button
                      className="mt-3 w-full text-xs"
                      style={{ backgroundColor: "#006039" }}
                      onClick={() => handleSignOffSection(sec.number)}
                    >
                      Sign Off — {sec.name}
                    </Button>
                  ) : null}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Section 19: Detail Library status (auto) */}
        <div
          className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border"
          style={detailLibraryReady ? { backgroundColor: "#E8F2ED" } : undefined}
        >
          <div className="flex items-center gap-2">
            {detailLibraryReady && <CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} />}
            <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>
              19. Detail Library
            </span>
          </div>
          <span className="text-xs" style={{ color: detailLibraryReady ? "#006039" : "#D4860A" }}>
            {detailLibraryStats.complete + detailLibraryStats.na} of {detailLibraryStats.total} Complete or N/A
          </span>
        </div>

        {/* GFC Issue Button */}
        {!isGfcIssued && isPrincipal && (
          <div className="relative group">
            <Button
              className="mt-2 w-full"
              style={{ backgroundColor: "#006039" }}
              disabled={!canIssueGFC || issuing}
              onClick={handleIssueGFC}
            >
              {issuing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Issue GFC
            </Button>
            {!canIssueGFC && !issuing && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[11px] px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                Complete QC Checklist and Detail Library before issuing GFC.
                {remainingItems > 0 ? ` ${remainingItems} items remaining.` : ""}
                {!allSectionsSigned ? ` ${sections.filter(s => !s.signoff).length} sections need sign-off.` : ""}
                {!detailLibraryReady ? " Detail Library incomplete." : ""}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
