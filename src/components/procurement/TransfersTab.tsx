import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Truck, Check, Clock, Package, Wrench, Plus, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { NewTransferDialog } from "./NewTransferDialog";

type Transfer = {
  id: string;
  project_id: string;
  project_name: string;
  status: string;
  created_at: string;
  dispatch_confirmed_at: string | null;
  dispatch_confirmed_by: string | null;
  dispatch_confirmed_name: string | null;
  dispatch_confirmed_role: string | null;
  modules_signed_at: string | null;
  modules_signed_name: string | null;
  modules_checklist: boolean[] | null;
  tools_signed_at: string | null;
  tools_signed_name: string | null;
  tools_checklist: boolean[] | null;
  additional_signed_at: string | null;
  additional_signed_name: string | null;
  additional_materials: any[] | null;
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#666666", bg: "#E0E0E0" },
  in_progress: { label: "Pending", color: "#666666", bg: "#E0E0E0" },
  complete: { label: "In Transit", color: "#D4860A", bg: "#FFF8E8" },
  dispatched: { label: "In Transit", color: "#D4860A", bg: "#FFF8E8" },
  delivered: { label: "Delivered", color: "#006039", bg: "#E8F2ED" },
};

export function TransfersTab() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTransferOpen, setNewTransferOpen] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    const [{ data: checklists }, { data: projList }, { data: profiles }] = await Promise.all([
      (supabase.from("delivery_checklists") as any)
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name").eq("is_archived", false),
      supabase.from("profiles").select("auth_user_id, full_name, role"),
    ]);

    const projMap: Record<string, string> = {};
    (projList ?? []).forEach((p: any) => { projMap[p.id] = p.name; });
    setProjects(projList ?? []);

    const profileMap: Record<string, { name: string; role: string }> = {};
    (profiles ?? []).forEach((p: any) => {
      profileMap[p.auth_user_id] = { name: p.full_name ?? "Unknown", role: (p.role ?? "").replace(/_/g, " ") };
    });

    const mapped: Transfer[] = (checklists ?? []).map((c: any) => ({
      id: c.id,
      project_id: c.project_id,
      project_name: projMap[c.project_id] ?? "Unknown Project",
      status: c.status,
      created_at: c.created_at,
      dispatch_confirmed_at: c.dispatch_confirmed_at,
      dispatch_confirmed_by: c.dispatch_confirmed_by,
      dispatch_confirmed_name: c.dispatch_confirmed_by ? profileMap[c.dispatch_confirmed_by]?.name ?? null : null,
      dispatch_confirmed_role: c.dispatch_confirmed_by ? profileMap[c.dispatch_confirmed_by]?.role ?? null : null,
      modules_signed_at: c.modules_signed_at,
      modules_signed_name: c.modules_signed_by ? profileMap[c.modules_signed_by]?.name ?? null : null,
      modules_checklist: c.modules_checklist,
      tools_signed_at: c.tools_signed_at,
      tools_signed_name: c.tools_signed_by ? profileMap[c.tools_signed_by]?.name ?? null : null,
      tools_checklist: c.tools_checklist,
      additional_signed_at: c.additional_signed_at,
      additional_signed_name: c.additional_signed_by ? profileMap[c.additional_signed_by]?.name ?? null : null,
      additional_materials: c.additional_materials,
    }));

    setTransfers(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  const filtered = useMemo(() => {
    return transfers.filter((t) => {
      if (filterProject !== "all" && t.project_id !== filterProject) return false;
      if (filterStatus !== "all") {
        const mapped = STATUS_MAP[t.status]?.label?.toLowerCase() ?? "";
        if (filterStatus === "pending" && mapped !== "pending") return false;
        if (filterStatus === "in_transit" && mapped !== "in transit") return false;
        if (filterStatus === "delivered" && mapped !== "delivered") return false;
      }
      if (filterFrom) {
        const from = parseISO(filterFrom);
        const date = parseISO(t.created_at);
        if (date < from) return false;
      }
      if (filterTo) {
        const to = parseISO(filterTo);
        const date = parseISO(t.created_at);
        if (date > to) return false;
      }
      return true;
    });
  }, [transfers, filterProject, filterStatus, filterFrom, filterTo]);

  // Summary stats
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const thisMonthCount = transfers.filter((t) => {
    try { return isWithinInterval(parseISO(t.created_at), { start: monthStart, end: monthEnd }); } catch { return false; }
  }).length;
  const activeProjectCount = new Set(
    transfers.filter((t) => ["dispatched", "complete", "in_progress"].includes(t.status)).map((t) => t.project_id)
  ).size;
  const pendingCount = transfers.filter((t) => ["pending", "in_progress"].includes(t.status)).length;

  const openDetail = (t: Transfer) => {
    setSelectedTransfer(t);
    setDrawerOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>Material Transfers</h2>
        <Button size="sm" onClick={() => setNewTransferOpen(true)} style={{ backgroundColor: "#006039" }} className="text-white gap-1 text-xs">
          <Plus className="h-3 w-3" /> New Transfer
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[180px] shrink-0 text-sm">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="w-[140px] shrink-0 text-sm"
          placeholder="From"
        />
        <Input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="w-[140px] shrink-0 text-sm"
          placeholder="To"
        />

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] shrink-0 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg p-3" style={{ backgroundColor: "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{thisMonthCount}</p>
          <p className="text-xs font-medium mt-0.5" style={{ color: "#666666" }}>Transfers This Month</p>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{activeProjectCount}</p>
          <p className="text-xs font-medium mt-0.5" style={{ color: "#666666" }}>Active Projects</p>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: pendingCount > 0 ? "#FFF8E8" : "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <p className="text-2xl font-bold" style={{ color: pendingCount > 0 ? "#D4860A" : "#1A1A1A" }}>{pendingCount}</p>
          <p className="text-xs font-medium mt-0.5" style={{ color: "#666666" }}>Pending Confirmations</p>
        </div>
      </div>

      {/* Transfer cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg p-8 text-center" style={{ backgroundColor: "#F7F7F7" }}>
          <Truck className="h-8 w-8 mx-auto mb-2" style={{ color: "#999999" }} />
          <p className="text-sm" style={{ color: "#999999" }}>No transfers found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const st = STATUS_MAP[t.status] ?? STATUS_MAP.pending;
            const modulesCount = t.modules_checklist ? t.modules_checklist.filter(Boolean).length : 0;
            const toolsPacked = !!t.tools_signed_at;
            const additionalCount = (t.additional_materials ?? []).length;

            return (
              <Card
                key={t.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                style={{ backgroundColor: "#FFFFFF" }}
                onClick={() => openDetail(t)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold text-sm truncate" style={{ color: "#1A1A1A" }}>
                        {t.project_name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#666666" }}>
                        {format(parseISO(t.created_at), "dd/MM/yyyy")}
                        {t.dispatch_confirmed_name && (
                          <> · Confirmed by <span className="font-medium">{t.dispatch_confirmed_name}</span> ({t.dispatch_confirmed_role})</>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0"
                      style={{ backgroundColor: st.bg, color: st.color, borderColor: "transparent" }}
                    >
                      {st.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "#666666" }}>
                    <span className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" /> Modules: {modulesCount}/{t.modules_checklist?.length ?? 13}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5" />
                      Tools: {toolsPacked ? (
                        <span style={{ color: "#006039" }}>✓ Packed</span>
                      ) : (
                        <span style={{ color: "#D4860A" }}>⚠ Pending</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5" /> Additional: {additionalCount || "None"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-[420px] overflow-y-auto">
          {selectedTransfer && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display" style={{ color: "#1A1A1A" }}>
                  {selectedTransfer.project_name}
                </SheetTitle>
                <p className="text-xs" style={{ color: "#666666" }}>
                  Transfer — {format(parseISO(selectedTransfer.created_at), "dd/MM/yyyy")}
                </p>
              </SheetHeader>

              <div className="mt-4 space-y-3">
                {/* Status */}
                {(() => {
                  const st = STATUS_MAP[selectedTransfer.status] ?? STATUS_MAP.pending;
                  return (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" style={{ backgroundColor: st.bg, color: st.color, borderColor: "transparent" }}>
                        {st.label}
                      </Badge>
                      {["dispatched", "complete"].includes(selectedTransfer.status) && (
                        <span className="text-xs italic" style={{ color: "#999999" }}>
                          Awaiting site receipt confirmation
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Dispatch info */}
                {selectedTransfer.dispatch_confirmed_at && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: "#F7F7F7" }}>
                    <p className="text-xs font-medium" style={{ color: "#666666" }}>Dispatch Confirmed</p>
                    <p className="text-sm mt-0.5" style={{ color: "#1A1A1A" }}>
                      {selectedTransfer.dispatch_confirmed_name} ({selectedTransfer.dispatch_confirmed_role})
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#999999" }}>
                      {format(parseISO(selectedTransfer.dispatch_confirmed_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                )}

                <Accordion type="multiple" className="w-full">
                  {/* Modules section */}
                  <AccordionItem value="modules">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Modules & Panels
                        {selectedTransfer.modules_signed_at && <Check className="h-3.5 w-3.5" style={{ color: "#006039" }} />}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {selectedTransfer.modules_signed_at ? (
                        <div className="space-y-2">
                          <div className="rounded p-2" style={{ backgroundColor: "#E8F2ED" }}>
                            <p className="text-xs font-medium" style={{ color: "#006039" }}>
                              Signed by {selectedTransfer.modules_signed_name} · {format(parseISO(selectedTransfer.modules_signed_at), "dd/MM/yyyy HH:mm")}
                            </p>
                          </div>
                          <p className="text-xs" style={{ color: "#666666" }}>
                            {selectedTransfer.modules_checklist?.filter(Boolean).length ?? 0} of {selectedTransfer.modules_checklist?.length ?? 13} items checked
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color: "#999999" }}>Not yet signed off</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Tools section */}
                  <AccordionItem value="tools">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" /> Tools & Equipment
                        {selectedTransfer.tools_signed_at && <Check className="h-3.5 w-3.5" style={{ color: "#006039" }} />}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {selectedTransfer.tools_signed_at ? (
                        <div className="space-y-2">
                          <div className="rounded p-2" style={{ backgroundColor: "#E8F2ED" }}>
                            <p className="text-xs font-medium" style={{ color: "#006039" }}>
                              Signed by {selectedTransfer.tools_signed_name} · {format(parseISO(selectedTransfer.tools_signed_at), "dd/MM/yyyy HH:mm")}
                            </p>
                          </div>
                          <p className="text-xs" style={{ color: "#666666" }}>
                            {selectedTransfer.tools_checklist?.filter(Boolean).length ?? 0} of {selectedTransfer.tools_checklist?.length ?? 30} items checked
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color: "#999999" }}>Not yet signed off</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Additional materials */}
                  <AccordionItem value="additional">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Additional Materials
                        {selectedTransfer.additional_signed_at && <Check className="h-3.5 w-3.5" style={{ color: "#006039" }} />}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {selectedTransfer.additional_signed_at ? (
                        <div className="space-y-2">
                          <div className="rounded p-2" style={{ backgroundColor: "#E8F2ED" }}>
                            <p className="text-xs font-medium" style={{ color: "#006039" }}>
                              Signed by {selectedTransfer.additional_signed_name} · {format(parseISO(selectedTransfer.additional_signed_at), "dd/MM/yyyy HH:mm")}
                            </p>
                          </div>
                          {(selectedTransfer.additional_materials ?? []).length > 0 ? (
                            <div className="space-y-1">
                              {(selectedTransfer.additional_materials ?? []).map((m: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-xs p-2 rounded" style={{ backgroundColor: "#F7F7F7" }}>
                                  <span style={{ color: "#1A1A1A" }}>{m.description || "—"}</span>
                                  <span style={{ color: "#666666" }}>{m.qty} {m.unit} · {m.source}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs italic" style={{ color: "#999999" }}>No additional materials required</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color: "#999999" }}>Not yet signed off</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
