import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";

interface CashPosition {
  bankBalance: number;
  payables: number;
  receivables: number;
  netPosition: number;
}

export function CashPositionCard() {
  const [pos, setPos] = useState<CashPosition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPosition(); }, []);

  const fetchPosition = async () => {
    setLoading(true);

    // Bank balance: latest entry from bank_ledger_entries
    const { data: bankEntries } = await (supabase.from("bank_ledger_entries" as any) as any)
      .select("closing_balance")
      .order("entry_date", { ascending: false })
      .limit(1);
    const bankBalance = Number((bankEntries as any)?.[0]?.closing_balance ?? 0);

    // Payables: sum of creditor_ledger_entries that are unpaid (overdue or due)
    const { data: creditorEntries } = await (supabase.from("creditor_ledger_entries" as any) as any)
      .select("amount")
      .eq("is_paid", false);
    const payables = (creditorEntries as any[])?.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) ?? 0;

    // Receivables: sum of debtor_ledger_entries that are unpaid
    const { data: debtorEntries } = await (supabase.from("debtor_ledger_entries" as any) as any)
      .select("amount")
      .eq("is_paid", false);
    const receivables = (debtorEntries as any[])?.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) ?? 0;

    const netPosition = bankBalance + receivables - payables;
    setPos({ bankBalance, payables, receivables, netPosition });
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!pos) return null;

  const isPositive = pos.netPosition >= 0;

  const values = [
    { label: "Bank Balance", value: pos.bankBalance, color: "#006039" },
    { label: "Payables", value: pos.payables, color: "#F40009" },
    { label: "Receivables", value: pos.receivables, color: "#D4860A" },
    { label: "Net Position", value: pos.netPosition, color: isPositive ? "#006039" : "#F40009", bold: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {values.map((v) => (
        <Card key={v.label} className="border" style={{ borderColor: v.bold ? v.color : undefined }}>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#666" }}>{v.label}</p>
            <div className="flex items-center gap-1">
              {v.bold && (isPositive ? <TrendingUp className="h-4 w-4" style={{ color: v.color }} /> : <TrendingDown className="h-4 w-4" style={{ color: v.color }} />)}
              <p className={`font-mono font-bold ${v.bold ? "text-lg" : "text-base"}`} style={{ color: v.color }}>
                {v.value < 0 ? "-" : ""}₹{Math.abs(v.value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
