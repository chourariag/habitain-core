import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user is a director
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: isDir } = await supabase.rpc("is_director", { _user_id: user.id });
    if (!isDir) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const { reportDate, periodType } = await req.json();
    const reportDt = new Date(reportDate);
    const year = reportDt.getFullYear();
    const month = reportDt.getMonth(); // 0-indexed

    // Period boundaries
    let periodStart: string, periodEnd: string;
    if (periodType === "quarterly") {
      const qStart = Math.floor(month / 3) * 3;
      periodStart = new Date(year, qStart, 1).toISOString();
      periodEnd = new Date(year, qStart + 3, 0, 23, 59, 59).toISOString();
    } else {
      periodStart = new Date(year, month, 1).toISOString();
      periodEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    }

    // Previous period for comparison
    let prevStart: string, prevEnd: string;
    if (periodType === "quarterly") {
      const qStart = Math.floor(month / 3) * 3;
      prevStart = new Date(year, qStart - 3, 1).toISOString();
      prevEnd = new Date(year, qStart, 0, 23, 59, 59).toISOString();
    } else {
      prevStart = new Date(year, month - 1, 1).toISOString();
      prevEnd = new Date(year, month, 0, 23, 59, 59).toISOString();
    }

    // §2 — Project Portfolio
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, client_name, status, est_completion, gfc_budget, type, construction_type")
      .eq("is_archived", false);

    const { data: modules } = await supabase
      .from("modules")
      .select("id, project_id, current_stage");

    const { data: revenueMargin } = await supabase
      .from("project_revenue_margin")
      .select("project_id, original_valuation, expected_final_cost, gfc_margin_pct, tender_margin_pct");

    const { data: billingMilestones } = await supabase
      .from("project_billing_milestones")
      .select("*");

    // §3 — Revenue & Collections
    const { data: invoices } = await supabase
      .from("project_invoices")
      .select("*");

    const { data: debtors } = await supabase
      .from("debtor_ledger_entries")
      .select("*");

    // §4 — Costs
    const { data: expenses } = await supabase
      .from("expense_entries")
      .select("amount, expense_type, category, entry_date, status")
      .gte("entry_date", periodStart.split("T")[0])
      .lte("entry_date", periodEnd.split("T")[0]);

    // §5 — Operations
    const { data: ncrs } = await supabase
      .from("ncr_register")
      .select("id, status, created_at, closed_at");

    const { data: dispatches } = await supabase
      .from("dispatch_log")
      .select("id, dispatch_date");

    const { data: dailyActuals } = await supabase
      .from("daily_actuals")
      .select("hours_worked, date")
      .gte("date", periodStart.split("T")[0])
      .lte("date", periodEnd.split("T")[0]);

    // §6 — Sales
    const { data: deals } = await supabase
      .from("sales_deals")
      .select("*");

    // §7 — Cashflow
    const { data: bankEntries } = await supabase
      .from("bank_ledger_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(1);

    const { data: creditors } = await supabase
      .from("creditor_ledger_entries")
      .select("amount, status");

    // §8 — Risks
    const { data: alerts } = await supabase
      .from("red_flag_alerts")
      .select("*")
      .eq("is_resolved", false);

    const { data: notifications } = await supabase
      .from("notifications")
      .select("title, body, created_at, priority")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(20);

    // §9 — Upcoming milestones
    const next60 = new Date(reportDt.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: upcomingDispatches } = await supabase
      .from("dispatch_packs")
      .select("dispatch_pack_id, project_id, dispatch_date, status")
      .gte("dispatch_date", reportDate)
      .lte("dispatch_date", next60.split("T")[0]);

    const { data: upcomingBilling } = await supabase
      .from("project_billing_milestones")
      .select("project_id, milestone_number, description, amount_incl_gst, status")
      .eq("status", "Upcoming");

    const { data: statutory } = await supabase
      .from("finance_statutory")
      .select("*")
      .eq("is_completed", false);

    // Compile data
    const activeProjects = (projects || []).filter(p => p.status !== "completed" && p.status !== "cancelled");
    const modulesPerProject = (modules || []).reduce((acc: Record<string, number>, m) => {
      acc[m.project_id] = (acc[m.project_id] || 0) + 1;
      return acc;
    }, {});

    // Revenue data
    const periodInvoices = (invoices || []).filter(i => 
      i.raised_date >= periodStart.split("T")[0] && i.raised_date <= periodEnd.split("T")[0]
    );
    const prevPeriodInvoices = (invoices || []).filter(i =>
      i.raised_date >= prevStart.split("T")[0] && i.raised_date <= prevEnd.split("T")[0]
    );
    const totalRevenue = periodInvoices.reduce((s, i) => s + (i.amount_total || 0), 0);
    const prevRevenue = prevPeriodInvoices.reduce((s, i) => s + (i.amount_total || 0), 0);
    const totalCollections = periodInvoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
    const totalOutstanding = (invoices || []).reduce((s, i) => s + (i.amount_outstanding || 0), 0);

    // Debtors aging
    const now = new Date();
    const aged = { "0_30": 0, "31_60": 0, "60_plus": 0 };
    (debtors || []).forEach(d => {
      if (d.status === "paid") return;
      const days = d.overdue_days || 0;
      if (days <= 30) aged["0_30"] += d.amount;
      else if (days <= 60) aged["31_60"] += d.amount;
      else aged["60_plus"] += d.amount;
    });

    // Pipeline billing next 90 days
    const next90 = new Date(reportDt.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const pipelineRevenue = (billingMilestones || [])
      .filter(m => m.status === "Upcoming")
      .reduce((s, m) => s + (m.amount_incl_gst || 0), 0);

    // Costs
    const approvedExpenses = (expenses || []).filter(e => e.status !== "Rejected");
    const totalCosts = approvedExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const labourCost = approvedExpenses.filter(e => e.category === "Labour" || e.expense_type === "labour").reduce((s, e) => s + (e.amount || 0), 0);
    const materialCost = approvedExpenses.filter(e => e.category === "Material" || e.expense_type === "material").reduce((s, e) => s + (e.amount || 0), 0);

    // Margin by project
    const marginByProject = activeProjects.map(p => {
      const rm = (revenueMargin || []).find(r => r.project_id === p.id);
      return {
        name: p.name,
        margin_pct: rm?.gfc_margin_pct || rm?.tender_margin_pct || null,
        contract_value: rm?.original_valuation || 0,
      };
    });
    const blendedMargin = marginByProject.length > 0
      ? marginByProject.reduce((s, m) => s + (m.margin_pct || 0), 0) / marginByProject.filter(m => m.margin_pct).length
      : 0;

    // Operations
    const periodNCRs = (ncrs || []).filter(n => n.created_at >= periodStart && n.created_at <= periodEnd);
    const ncrRaised = periodNCRs.length;
    const ncrClosed = periodNCRs.filter(n => n.status === "Closed").length;
    const ncrPending = (ncrs || []).filter(n => n.status !== "Closed").length;
    const periodDispatches = (dispatches || []).filter(d => d.dispatch_date >= periodStart.split("T")[0] && d.dispatch_date <= periodEnd.split("T")[0]);
    const modulesInProduction = (modules || []).filter(m => m.current_stage > 0 && m.current_stage < 10).length;

    // Sales
    const periodDeals = (deals || []).filter(d => d.created_at >= periodStart && d.created_at <= periodEnd);
    const wonDeals = (deals || []).filter(d => d.stage === "Won" && d.updated_at >= periodStart && d.updated_at <= periodEnd);
    const lostDeals = (deals || []).filter(d => d.stage === "Lost" && d.updated_at >= periodStart && d.updated_at <= periodEnd);
    const activeDeals = (deals || []).filter(d => d.stage !== "Won" && d.stage !== "Lost" && !d.is_archived);
    const pipelineValue = activeDeals.reduce((s, d) => s + (d.contract_value || 0), 0);
    const newLeads = periodDeals.length;
    const winRate = (wonDeals.length + lostDeals.length) > 0
      ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
      : 0;

    // Cashflow
    const latestBankBalance = bankEntries?.[0]?.balance || 0;
    const totalPayables = (creditors || []).filter(c => c.status !== "paid").reduce((s, c) => s + (c.amount || 0), 0);

    // Build sections
    const sections = {
      executive_summary: {
        company: "Alternate Real Estate Experiences Pvt Ltd (ALTREE)",
        division: "Habitainer",
        period: periodType === "quarterly" 
          ? `Q${Math.floor(month / 3) + 1} ${year}` 
          : `${reportDt.toLocaleString("en-IN", { month: "long" })} ${year}`,
        date_prepared: new Date().toISOString().split("T")[0],
      },
      project_portfolio: {
        projects: activeProjects.map(p => {
          const rm = (revenueMargin || []).find(r => r.project_id === p.id);
          const mods = modulesPerProject[p.id] || 0;
          const completedModules = (modules || []).filter(m => m.project_id === p.id && m.current_stage >= 10).length;
          const totalMods = (modules || []).filter(m => m.project_id === p.id).length;
          const pctComplete = totalMods > 0 ? Math.round((completedModules / totalMods) * 100) : 0;
          return {
            name: p.name,
            module_count: mods,
            contract_value: rm?.original_valuation || 0,
            pct_complete: pctComplete,
            margin_pct: rm?.gfc_margin_pct || rm?.tender_margin_pct || 0,
            status: p.status,
            handover_date: p.est_completion,
          };
        }),
        summary: {
          total_active: activeProjects.length,
          total_contract_value: marginByProject.reduce((s, m) => s + m.contract_value, 0),
          avg_margin: Math.round(blendedMargin),
          on_track: activeProjects.filter(p => p.status === "active" || p.status === "in_progress").length,
          delayed: activeProjects.filter(p => p.status === "delayed").length,
        },
      },
      revenue_collections: {
        total_revenue: totalRevenue,
        total_collections: totalCollections,
        outstanding_receivables: totalOutstanding,
        aged_receivables: aged,
        revenue_pipeline_90d: pipelineRevenue,
        prev_period_revenue: prevRevenue,
        change_pct: prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : null,
      },
      cost_margin: {
        total_costs: totalCosts,
        blended_margin: Math.round(blendedMargin),
        margin_by_project: marginByProject,
        flagged_projects: marginByProject.filter(m => (m.margin_pct || 0) < 20),
        labour_cost: labourCost,
        material_cost: materialCost,
      },
      operational_metrics: {
        modules_in_production: modulesInProduction,
        modules_dispatched: periodDispatches.length,
        ncr_raised: ncrRaised,
        ncr_closed: ncrClosed,
        ncr_pending: ncrPending,
        total_modules: (modules || []).length,
      },
      sales_pipeline: {
        new_leads: newLeads,
        deals_won: wonDeals.length,
        deals_won_value: wonDeals.reduce((s, d) => s + (d.contract_value || 0), 0),
        deals_lost: lostDeals.length,
        deals_lost_value: lostDeals.reduce((s, d) => s + (d.contract_value || 0), 0),
        win_rate: winRate,
        pipeline_value: pipelineValue,
        active_deals: activeDeals.length,
      },
      cashflow: {
        bank_balance: latestBankBalance,
        payables: totalPayables,
        receivables: totalOutstanding,
        net_cash: latestBankBalance - totalPayables + totalOutstanding,
      },
      risks: {
        alerts: (alerts || []).map(a => ({
          id: a.id,
          title: a.title || a.alert_type,
          description: a.description,
          severity: a.severity,
          project_id: a.project_id,
        })),
        critical_notifications: (notifications || []).filter(n => n.priority === "critical").slice(0, 10).map(n => ({
          title: n.title,
          body: n.body,
          date: n.created_at,
        })),
      },
      upcoming_milestones: {
        dispatches: (upcomingDispatches || []).map(d => ({
          pack_id: d.dispatch_pack_id,
          project_id: d.project_id,
          date: d.dispatch_date,
          status: d.status,
        })),
        billing: (upcomingBilling || []).map(b => ({
          project_id: b.project_id,
          milestone: b.description,
          amount: b.amount_incl_gst,
        })),
        statutory: (statutory || []).map(s => ({
          filing_name: s.filing_name,
          due_date: s.due_date,
          status: s.status,
        })),
      },
    };

    // Enrich with project names
    const projectMap = (projects || []).reduce((acc: Record<string, string>, p) => {
      acc[p.id] = p.name;
      return acc;
    }, {});

    sections.upcoming_milestones.dispatches = sections.upcoming_milestones.dispatches.map(d => ({
      ...d,
      project_name: projectMap[d.project_id] || d.project_id,
    }));
    sections.upcoming_milestones.billing = sections.upcoming_milestones.billing.map(b => ({
      ...b,
      project_name: projectMap[b.project_id] || b.project_id,
    }));

    return new Response(JSON.stringify({ sections }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
