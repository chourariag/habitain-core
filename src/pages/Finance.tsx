import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { FinanceOverviewStrip } from "@/components/finance/FinanceOverviewStrip";
import { MISTab } from "@/components/finance/MISTab";
import { PLTab } from "@/components/finance/PLTab";
import { CashFlowTab } from "@/components/finance/CashFlowTab";
import { ProjectBudgetsTab } from "@/components/finance/ProjectBudgetsTab";
import { PaymentsTab } from "@/components/finance/PaymentsTab";
import { StatutoryTab } from "@/components/finance/StatutoryTab";
import { InvoicesTab } from "@/components/finance/InvoicesTab";

export default function Finance() {
  return (
    <div className="p-4 md:p-6 max-w-full overflow-x-hidden">
      <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "#1A1A1A" }}>
        Finance
      </h1>
      <p className="text-sm mb-4" style={{ color: "#666666" }}>
        Financial reporting, payments & compliance
      </p>

      <FinanceOverviewStrip />

      <Tabs defaultValue="mis" className="w-full">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="mis">MIS</TabsTrigger>
            <TabsTrigger value="pl">P&L</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="budgets">Project Budgets</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="statutory">Statutory</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="mis"><MISTab /></TabsContent>
        <TabsContent value="pl"><PLTab /></TabsContent>
        <TabsContent value="cashflow"><CashFlowTab /></TabsContent>
        <TabsContent value="budgets"><ProjectBudgetsTab /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="statutory"><StatutoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
