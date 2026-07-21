import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { FinanceOverviewStrip } from "@/components/finance/FinanceOverviewStrip";
import { MISTab } from "@/components/finance/MISTab";
import { ProfitLossTab } from "@/components/finance/ProfitLossTab";
import { CashFlowTab } from "@/components/finance/CashFlowTab";
import { PaymentsTab } from "@/components/finance/PaymentsTab";
import { StatutoryTab } from "@/components/finance/StatutoryTab";
import { InvoicesTab } from "@/components/finance/InvoicesTab";
import { RevenueMarginTab } from "@/components/finance/RevenueMarginTab";
import { WorkOrdersTab } from "@/components/work-orders/WorkOrdersTab";
import { AdvanceApprovalsTab } from "@/components/finance/AdvanceApprovalsTab";
import { ReceivablesTab } from "@/components/finance/ReceivablesTab";
import { BillingTrackerTab } from "@/components/finance/BillingTrackerTab";
import { TallyIncomingSyncLogTab } from "@/components/finance/TallyIncomingSyncLogTab";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

const VALID_TABS = new Set([
  "mis-invoices", "revenue-margin", "costing", "pl-cashflow", "bank-overdue", "statutory",
]);

export default function Finance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : "mis-invoices";

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-full overflow-x-hidden">
      <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "#1A1A1A" }}>
        Finance
      </h1>
      <p className="text-sm mb-4" style={{ color: "#666666" }}>
        Company-level financial reporting, payments & compliance
      </p>

      <FinanceOverviewStrip />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="mis-invoices">MIS &amp; Invoices</TabsTrigger>
            <TabsTrigger value="revenue-margin">Revenue &amp; Margin</TabsTrigger>
            <TabsTrigger value="costing">Costing &amp; Estimation</TabsTrigger>
            <TabsTrigger value="pl-cashflow">Project P&amp;L &amp; Cash Flow</TabsTrigger>
            <TabsTrigger value="bank-overdue">Bank Ledger &amp; Overdue</TabsTrigger>
            <TabsTrigger value="statutory">Statutory</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        {/* MIS & Invoices: MIS, Invoices, Tally Ledger Classification */}
        <TabsContent value="mis-invoices">
          <Tabs defaultValue="mis" className="w-full">
            <TabsList>
              <TabsTrigger value="mis">MIS</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="billing-tracker">Billing Tracker</TabsTrigger>
              <TabsTrigger value="tally-ledger">Tally Ledger Classification</TabsTrigger>
              <TabsTrigger value="tally-incoming">Tally Incoming Sync Log</TabsTrigger>
            </TabsList>
            <TabsContent value="mis"><MISTab /></TabsContent>
            <TabsContent value="invoices"><InvoicesTab /></TabsContent>
            <TabsContent value="billing-tracker"><BillingTrackerTab /></TabsContent>
            <TabsContent value="tally-ledger">
              <Card><CardContent className="p-6 flex items-start gap-3">
                <Info className="h-5 w-5 mt-0.5" style={{ color: "#006039" }} />
                <div className="text-sm" style={{ color: "#666666" }}>
                  Tally ledger auto-classification with first-time prompt is scheduled for the next iteration.
                  When a new ledger is detected, you will be asked to map it to a Finance category once;
                  subsequent transactions auto-classify.
                </div>
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="tally-incoming"><TallyIncomingSyncLogTab /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="revenue-margin"><RevenueMarginTab /></TabsContent>

        {/* Costing & Estimation: WO, PO, Expense approvals all live here now */}
        <TabsContent value="costing">
          <Tabs defaultValue="work-orders" className="w-full">
            <TabsList>
              <TabsTrigger value="work-orders">Work Order Approvals</TabsTrigger>
              <TabsTrigger value="po-approvals">PO Approvals</TabsTrigger>
              <TabsTrigger value="expense-approvals">Expense Approvals</TabsTrigger>
              <TabsTrigger value="advance-approvals">Advance Requests</TabsTrigger>
            </TabsList>
            <TabsContent value="work-orders"><WorkOrdersTab mode="finance" /></TabsContent>
            <TabsContent value="po-approvals">
              <Card><CardContent className="p-6 flex items-start gap-3">
                <Info className="h-5 w-5 mt-0.5" style={{ color: "#006039" }} />
                <div className="text-sm" style={{ color: "#666666" }}>
                  Purchase Order approvals are being migrated here from Procurement. Until the migration completes,
                  use Procurement → Purchase Orders to action pending items.
                </div>
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="expense-approvals">
              <Card><CardContent className="p-6 flex items-start gap-3">
                <Info className="h-5 w-5 mt-0.5" style={{ color: "#006039" }} />
                <div className="text-sm" style={{ color: "#666666" }}>
                  Expense approvals are being migrated here. Until then, action pending expenses from the
                  Approvals queue in the sidebar.
                </div>
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="advance-approvals"><AdvanceApprovalsTab /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="pl-cashflow">
          <Tabs defaultValue="pl" className="w-full">
            <TabsList>
              <TabsTrigger value="pl">P&amp;L</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
              <TabsTrigger value="receivables">Receivables</TabsTrigger>
            </TabsList>
            <TabsContent value="pl"><ProfitLossTab /></TabsContent>
            <TabsContent value="cashflow"><CashFlowTab /></TabsContent>
            <TabsContent value="receivables"><ReceivablesTab /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="bank-overdue"><PaymentsTab /></TabsContent>
        <TabsContent value="statutory"><StatutoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
