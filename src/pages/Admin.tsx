import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, ShieldOff, TrendingUp, FileText, CalendarClock, ShieldAlert } from "lucide-react";
import { AddUserDialog } from "@/components/admin/AddUserDialog";
import { UserRow } from "@/components/admin/UserRow";
import { ROLE_LABELS, AppRole } from "@/lib/roles";
import { BenchmarksView } from "@/components/kpi/BenchmarksView";
import { BoardPaperGenerator } from "@/components/admin/BoardPaperGenerator";
import { WeeklyReportConfigsTab } from "@/components/reports/WeeklyReportConfigsTab";
import { SafetyIncidentsTab } from "@/components/safety/SafetyIncidentsTab";

export default function Admin() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active");

  const { data: profiles, refetch, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (profiles || []).filter((p) => {
    const isActive = p.is_active !== false;
    if (tab === "active" && !isActive) return false;
    if (tab === "inactive" && isActive) return false;

    if (search) {
      const q = search.toLowerCase();
      const matchName = p.display_name?.toLowerCase().includes(q);
      const matchEmail = p.email?.toLowerCase().includes(q);
      const matchRole = ROLE_LABELS[p.role as AppRole]?.toLowerCase().includes(q);
      return matchName || matchEmail || matchRole;
    }
    return true;
  });

  const activeCount = (profiles || []).filter((p) => p.is_active !== false).length;
  const inactiveCount = (profiles || []).filter((p) => p.is_active === false).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Admin
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeCount} active user{activeCount !== 1 ? "s" : ""} · {inactiveCount} deactivated
          </p>
        </div>
        {(tab === "active" || tab === "inactive") && <AddUserDialog onUserCreated={refetch} />}
      </div>

      {(tab === "active" || tab === "inactive") && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card text-card-foreground border-border"
          />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="active" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Active ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="inactive" className="gap-1.5">
            <ShieldOff className="h-3.5 w-3.5" />
            Inactive ({inactiveCount})
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Benchmarks
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Weekly Reports
          </TabsTrigger>
          <TabsTrigger value="safety" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            Safety Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="bg-card rounded-lg shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-card-foreground/60 text-sm">Loading users…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-card-foreground/60 text-sm">
                {search ? "No users match your search." : "No active users yet."}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((profile) => (
                  <UserRow key={profile.id} profile={profile} onUpdate={refetch} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="inactive" className="mt-4">
          <div className="bg-card rounded-lg shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-card-foreground/60 text-sm">Loading users…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-card-foreground/60 text-sm">
                {search ? "No users match your search." : "No deactivated users."}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((profile) => (
                  <UserRow key={profile.id} profile={profile} onUpdate={refetch} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="benchmarks" className="mt-4">
          <BenchmarksView />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <BoardPaperGenerator />
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <WeeklyReportConfigsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
