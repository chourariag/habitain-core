import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { CalendarDays, Plane, Receipt, Wallet, FileBadge, BarChart3 } from "lucide-react";
import { MyAttendanceTab } from "@/components/attendance/MyAttendanceTab";
import { MyLeaveTab } from "@/components/attendance/MyLeaveTab";
import { MyExpenses } from "@/components/expenses/MyExpenses";
import { MyPayslipsTab } from "@/components/attendance/MyPayslipsTab";
import { MyDocumentsTab } from "@/components/attendance/MyDocumentsTab";
import { MyKpisTab } from "@/components/hr/MyKpisTab";

export default function Attendance() {
  const { role } = useUserRole();
  const [tab, setTab] = useState("attendance");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>
          My HR
        </h1>
        <p className="text-sm mt-1" style={{ color: "#666" }}>
          Your personal attendance, leave, expenses, payslips and documents.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="attendance" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Attendance</TabsTrigger>
            <TabsTrigger value="leave" className="gap-1.5"><Plane className="h-4 w-4" /> Leave</TabsTrigger>
            <TabsTrigger value="expenses" className="gap-1.5"><Receipt className="h-4 w-4" /> Expenses</TabsTrigger>
            <TabsTrigger value="payslips" className="gap-1.5"><Wallet className="h-4 w-4" /> Payslips</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5"><FileBadge className="h-4 w-4" /> Documents</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="attendance" className="mt-4"><MyAttendanceTab userRole={role} /></TabsContent>
        <TabsContent value="leave" className="mt-4"><MyLeaveTab /></TabsContent>
        <TabsContent value="expenses" className="mt-4"><MyExpenses /></TabsContent>
        <TabsContent value="payslips" className="mt-4"><MyPayslipsTab /></TabsContent>
        <TabsContent value="documents" className="mt-4"><MyDocumentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
