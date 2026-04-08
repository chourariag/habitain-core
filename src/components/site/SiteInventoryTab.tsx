import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, PackageMinus, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SiteItem {
  id: string;
  material_name: string;
  qty_received: number;
  qty_used: number;
  qty_remaining: number;
  last_updated_at: string;
  last_updated_by: string | null;
}

interface ReturnRequest {
  id: string;
  status: string;
  initiated_at: string;
  items: any[];
  confirmed_at: string | null;
}

interface Props {
  projectId: string;
  userRole: string | null;
}

const USAGE_ROLES = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"];

export function SiteInventoryTab({ projectId, userRole }: Props) {
  const [items, setItems] = useState<SiteItem[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageMap, setUsageMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});

  const canLogUsage = USAGE_ROLES.includes(userRole || "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [invRes, retRes] = await Promise.all([
      supabase.from("site_inventory").select("*").eq("project_id", projectId).order("material_name"),
      supabase.from("material_returns").select("*").eq("project_id", projectId).order("initiated_at", { ascending: false }),
    ]);
    setItems((invRes.data as SiteItem[]) || []);
    setReturns((retRes.data as ReturnRequest[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogUsage = async (itemId: string) => {
    const qty = Number(usageMap[itemId]);
    if (!qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const item = items.find(i => i.id === itemId);
      if (!item) throw new Error("Item not found");
      if (qty > item.qty_remaining) { toast.error("Cannot use more than remaining"); setSaving(false); return; }

      const { client } = await getAuthedClient();
      const { error } = await (client.from("site_inventory") as any)
        .update({
          qty_used: item.qty_used + qty,
          last_updated_by: user.id,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);
      if (error) throw error;
      toast.success(`Logged ${qty} used`);
      setUsageMap(prev => ({ ...prev, [itemId]: "" }));
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleReturnSubmit = async () => {
    const returnItems = items
      .filter(i => Number(returnQty[i.id]) > 0)
      .map(i => ({ material_name: i.material_name, qty: Number(returnQty[i.id]) }));
    if (returnItems.length === 0) { toast.error("Select at least one material to return"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const { error } = await (client.from("material_returns") as any).insert({
        project_id: projectId,
        initiated_by: user.id,
        items: returnItems,
        status: "in_transit",
      });
      if (error) throw error;
      toast.success("Return request submitted — Stores notified");
      setReturnOpen(false);
      setReturnQty({});
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#666" }} /></div>;
  }

  const returnable = items.filter(i => i.qty_remaining > 0);

  return (
    <div className="space-y-4">
      {/* Return requests banner */}
      {returns.filter(r => r.status === "in_transit").length > 0 && (
        <Card className="border-l-4" style={{ borderLeftColor: "#D4860A", borderColor: "#E0E0E0" }}>
          <CardContent className="p-3">
            <p className="text-sm font-medium" style={{ color: "#D4860A" }}>
              <RotateCcw className="h-4 w-4 inline mr-1" />
              {returns.filter(r => r.status === "in_transit").length} material return(s) in transit to factory
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action bar */}
      {canLogUsage && returnable.length > 0 && (
        <div className="flex justify-end">
          <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" style={{ borderColor: "#D4860A", color: "#D4860A" }}>
                <PackageMinus className="h-4 w-4 mr-1" /> Return Materials to Factory
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-display">Return Materials</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {returnable.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded" style={{ backgroundColor: "#F7F7F7" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#1A1A1A" }}>{item.material_name}</p>
                      <p className="text-xs" style={{ color: "#666" }}>Available: {item.qty_remaining}</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={item.qty_remaining}
                      value={returnQty[item.id] || ""}
                      onChange={e => setReturnQty(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-20 text-sm"
                      placeholder="Qty"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={handleReturnSubmit} disabled={saving} style={{ backgroundColor: "#006039" }}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Submit Return
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Inventory table */}
      <Card className="border" style={{ borderColor: "#E0E0E0" }}>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                <TableHead className="text-xs font-semibold" style={{ color: "#666" }}>Material Name</TableHead>
                <TableHead className="text-xs font-semibold text-right" style={{ color: "#666" }}>Received</TableHead>
                <TableHead className="text-xs font-semibold text-right" style={{ color: "#666" }}>Used</TableHead>
                <TableHead className="text-xs font-semibold text-right" style={{ color: "#666" }}>Remaining</TableHead>
                <TableHead className="text-xs font-semibold" style={{ color: "#666" }}>Last Updated</TableHead>
                {canLogUsage && <TableHead className="text-xs font-semibold" style={{ color: "#666" }}>Log Usage</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canLogUsage ? 6 : 5} className="text-center py-8" style={{ color: "#999" }}>
                    No materials received at this site yet
                  </TableCell>
                </TableRow>
              ) : items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{item.material_name}</TableCell>
                  <TableCell className="text-right text-sm">{item.qty_received}</TableCell>
                  <TableCell className="text-right text-sm">{item.qty_used}</TableCell>
                  <TableCell className="text-right text-sm font-semibold" style={{ color: item.qty_remaining > 0 ? "#006039" : "#999" }}>
                    {item.qty_remaining}
                  </TableCell>
                  <TableCell className="text-xs" style={{ color: "#666" }}>
                    {format(new Date(item.last_updated_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  {canLogUsage && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={usageMap[item.id] || ""}
                          onChange={e => setUsageMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-16 h-7 text-xs"
                          placeholder="Qty"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleLogUsage(item.id)}
                          disabled={saving}
                          style={{ color: "#006039" }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
