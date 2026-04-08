import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Search, Star, Users } from "lucide-react";

interface Deal {
  id: string;
  client_name: string;
  project_type: string;
  contract_value: number;
  stage: string;
  lead_source: string;
  assigned_to: string | null;
  division: string;
  client_type: string;
  persona_tag: string | null;
  delivery_city: string | null;
  within_350km: boolean | null;
  amc_interest: string;
  re_engaged_at: string | null;
  referral_count: number;
  updated_at: string;
  [key: string]: any;
}

export function ClientDatabaseTab({ deals }: { deals: Deal[] }) {
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState("clients");

  const wonDeals = useMemo(() =>
    deals.filter(d => d.stage === "Won" && d.client_name.toLowerCase().includes(search.toLowerCase())),
    [deals, search]
  );

  const prospects = useMemo(() =>
    deals.filter(d => d.stage !== "Won" && d.stage !== "Lost" && d.client_name.toLowerCase().includes(search.toLowerCase())),
    [deals, search]
  );

  const fmt = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    return `₹${v?.toLocaleString() || 0}`;
  };

  const leadsBySource = useMemo(() => {
    const map: Record<string, number> = {};
    prospects.forEach(d => { map[d.lead_source] = (map[d.lead_source] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [prospects]);

  const stageBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    prospects.forEach(d => { map[d.stage] = (map[d.stage] || 0) + 1; });
    return Object.entries(map);
  }, [prospects]);

  const daysInStage = (d: Deal) => Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: "#999" }} />
        <Input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="clients">Clients ({wonDeals.length})</TabsTrigger>
          <TabsTrigger value="prospects">Prospects ({prospects.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>AMC</TableHead>
                  <TableHead>Referrals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wonDeals.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.client_name}</TableCell>
                    <TableCell>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#F7F7F7", color: "#666" }}>
                        {d.persona_tag || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {d.delivery_city || "—"}
                      {d.within_350km && <span className="text-[10px] ml-1" style={{ color: "#006039" }}>✓</span>}
                    </TableCell>
                    <TableCell className="font-semibold" style={{ color: "#006039" }}>{fmt(d.contract_value)}</TableCell>
                    <TableCell>
                      <span className="text-xs">{d.lead_source}</span>
                      {d.lead_source === "Referral" && <Star className="h-3 w-3 inline ml-1" style={{ color: "#D4860A" }} />}
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{
                          background: d.amc_interest === "yes" ? "#006039" : d.amc_interest === "no" ? "#666" : "#D4860A",
                          color: "#fff"
                        }}>
                        {d.amc_interest === "yes" ? "Active" : d.amc_interest === "no" ? "None" : "Pending"}
                      </span>
                    </TableCell>
                    <TableCell>{d.referral_count || 0}</TableCell>
                  </TableRow>
                ))}
                {wonDeals.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-xs" style={{ color: "#999" }}>No clients found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="prospects">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {leadsBySource.slice(0, 4).map(([source, count]) => (
              <Card key={source} className="p-2" style={{ background: "#F7F7F7" }}>
                <div className="text-[10px] uppercase font-semibold flex items-center gap-1" style={{ color: "#666" }}>
                  {source === "Referral" && <Star className="h-3 w-3" style={{ color: "#D4860A" }} />}
                  {source}
                </div>
                <div className="text-lg font-bold" style={{ color: "#006039" }}>{count}</div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {stageBreakdown.map(([stage, count]) => (
              <div key={stage} className="text-center p-2 rounded" style={{ background: "#E8F2ED" }}>
                <div className="text-[10px] font-semibold" style={{ color: "#006039" }}>{stage}</div>
                <div className="font-bold" style={{ color: "#006039" }}>{count}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Days in Stage</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map(d => {
                  const days = daysInStage(d);
                  const stagnationThreshold = d.client_type === "b2b_corporate" ? 45 : d.client_type === "resort_hospitality" ? 180 : 90;
                  const stagnant = days > stagnationThreshold;
                  return (
                    <TableRow key={d.id} style={{ background: stagnant ? "#FDE8E8" : undefined }}>
                      <TableCell className="font-medium">{d.client_name}</TableCell>
                      <TableCell className="text-xs">{d.client_type?.replace("_", " ")}</TableCell>
                      <TableCell>{d.stage}</TableCell>
                      <TableCell>
                        <span style={{ color: stagnant ? "#F40009" : "#1A1A1A", fontWeight: stagnant ? 700 : 400 }}>
                          {days}d {stagnant && "⚠"}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold" style={{ color: "#006039" }}>{fmt(d.contract_value)}</TableCell>
                      <TableCell>
                        <span className="text-xs">{d.lead_source}</span>
                        {d.lead_source === "Referral" && <Star className="h-3 w-3 inline ml-1" style={{ color: "#D4860A" }} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
