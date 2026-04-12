import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { FinanceOverviewStrip } from "@/components/finance/FinanceOverviewStrip";
import { MISTab } from "@/components/finance/MISTab";
import { PLTab } from "@/components/finance/PLTab";
import { CashFlowTab } from "@/components/finance/CashFlowTab";
import { ProjectBudgetsTab } from "@/components/finance/ProjectBudgetsTab";
import { PaymentsTab } from "@/components/finance/PaymentsTab";
import { StatutoryTab } from "@/components/finance/StatutoryTab";
import { WIPStatement } from "@/components/finance/WIPStatement";
import { CashPositionCard } from "@/components/finance/CashPositionCard";
import { LedgerUpload } from "@/components/finance/LedgerUpload";
import { InvoiceTracker } from "@/components/finance/InvoiceTracker";
import { RetentionTracker } from "@/components/finance/RetentionTracker";

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

      <div className="mb-4">
        <CashPositionCard />
      </div>

      <Tabs defaultValue="mis" className="w-full">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="mis">MIS</TabsTrigger>
            <TabsTrigger value="pl">P&L</TabsTrigger>
            <TabsTrigger value="wip">WIP</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="budgets">Project Budgets</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
            <TabsTrigger value="ledger">Ledger Upload</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="statutory">Statutory</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="mis"><MISTab /></TabsContent>
        <TabsContent value="pl"><PLTab /></TabsContent>
        <TabsContent value="wip"><WIPStatement /></TabsContent>
        <TabsContent value="cashflow"><CashFlowTab /></TabsContent>
        <TabsContent value="budgets"><ProjectBudgetsTab /></TabsContent>
        <TabsContent value="invoices"><InvoiceTracker /></TabsContent>
        <TabsContent value="retention"><RetentionTracker /></TabsContent>
        <TabsContent value="ledger"><LedgerUpload /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="statutory"><StatutoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
