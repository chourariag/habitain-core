import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SalesMetricsBar } from "@/components/sales/SalesMetricsBar";
import { PipelineKanban } from "@/components/sales/PipelineKanban";
import { SalesDualPipeline } from "@/components/sales/SalesDualPipeline";
import { AmcUpsellTab } from "@/components/sales/AmcUpsellTab";
import { DealDrawer } from "@/components/sales/DealDrawer";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";

export default function Sales() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDrawerOpen, setNewDrawerOpen] = useState(false);

  const fetchDeals = useCallback(async () => {
    const { data } = await supabase
      .from("sales_deals")
      .select("*")
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });
    setDeals(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  return (
    <div className="p-4 md:p-6 space-y-4" style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "#1A1A1A" }}>Sales Pipeline</h1>
        <Button onClick={() => setNewDrawerOpen(true)} style={{ background: "#006039", color: "#fff" }}>
          <Plus className="h-4 w-4 mr-1" /> New Deal
        </Button>
      </div>

      <Tabs defaultValue="pipeline">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="dual">Dual Pipeline</TabsTrigger>
            <TabsTrigger value="amc">AMC Upsell</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="pipeline" className="space-y-4">
          <SalesMetricsBar deals={deals} />
          {loading ? (
            <div className="text-center py-12" style={{ color: "#999" }}>Loading…</div>
          ) : (
            <PipelineKanban deals={deals} onRefresh={fetchDeals} />
          )}
        </TabsContent>

        <TabsContent value="dual" className="space-y-4">
          <SalesMetricsBar deals={deals} />
          {loading ? (
            <div className="text-center py-12" style={{ color: "#999" }}>Loading…</div>
          ) : (
            <SalesDualPipeline deals={deals} onRefresh={fetchDeals} />
          )}
        </TabsContent>

        <TabsContent value="amc">
          <AmcUpsellTab deals={deals.filter(d => d.stage === "Won")} />
        </TabsContent>
      </Tabs>

      <DealDrawer open={newDrawerOpen} onClose={() => setNewDrawerOpen(false)} deal={null} onSaved={fetchDeals} />
    </div>
  );
}
