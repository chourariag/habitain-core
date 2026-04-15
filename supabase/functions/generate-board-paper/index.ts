import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRAND_GREEN = "#006039";
const ALT_ROW = "#F7F7F7";
const WHITE = "#FFFFFF";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const { data: isDir } = await supabase.rpc("is_director", { _user_id: user.id });
    if (!isDir) return new Response("Forbidden", { status: 403, headers: corsHeaders });

    const { sections, commentary, reportDate, periodType } = await req.json();

    // Generate HTML-based PDF
    const formatCurrency = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

    const projectRows = (sections.project_portfolio?.projects || []).map((p: any, i: number) => `
      <tr style="background:${i % 2 === 0 ? WHITE : ALT_ROW}">
        <td style="padding:6px 10px;border:1px solid #ddd">${p.name}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${p.module_count}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right">${formatCurrency(p.contract_value)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${p.pct_complete}%</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;${(p.margin_pct||0)<20?'color:red;font-weight:bold':''}">${p.margin_pct||0}%</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-transform:capitalize">${p.status}</td>
        <td style="padding:6px 10px;border:1px solid #ddd">${p.handover_date||'—'}</td>
      </tr>
    `).join("");

    const marginRows = (sections.cost_margin?.margin_by_project || []).map((p: any, i: number) => `
      <tr style="background:${i % 2 === 0 ? WHITE : ALT_ROW}">
        <td style="padding:6px 10px;border:1px solid #ddd">${p.name}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;${(p.margin_pct||0)<20?'color:red;font-weight:bold':''}">${p.margin_pct||0}%</td>
      </tr>
    `).join("");

    const riskItems = (sections.risks?.alerts || []).map((a: any) =>
      `<li style="margin-bottom:6px"><strong>${a.title}</strong>: ${a.description || 'No details'}</li>`
    ).join("") || "<li>No critical risks active</li>";

    const dispatchItems = (sections.upcoming_milestones?.dispatches || []).map((d: any) =>
      `<li>${d.project_name} — ${d.date} (${d.status})</li>`
    ).join("") || "<li>None</li>";

    const billingItems = (sections.upcoming_milestones?.billing || []).map((b: any) =>
      `<li>${b.project_name} — ${b.milestone} — ${formatCurrency(b.amount)}</li>`
    ).join("") || "<li>None</li>";

    const statutoryItems = (sections.upcoming_milestones?.statutory || []).map((s: any) =>
      `<li>${s.filing_name} — Due: ${s.due_date}</li>`
    ).join("") || "<li>None</li>";

    const commentaryBlock = (key: string) => {
      const text = commentary?.[key];
      if (!text) return "";
      return `<div style="margin-top:10px;padding:10px;background:#FFF9E6;border-left:3px solid ${BRAND_GREEN};font-style:italic;font-size:11px">${text.replace(/\n/g, "<br>")}</div>`;
    };

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm 15mm 25mm 15mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.5; }
  h1 { color: ${BRAND_GREEN}; font-size: 24px; margin-bottom: 4px; }
  h2 { color: ${BRAND_GREEN}; font-size: 16px; border-bottom: 2px solid ${BRAND_GREEN}; padding-bottom: 4px; margin-top: 30px; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th { background: ${BRAND_GREEN}; color: white; padding: 8px 10px; text-align: left; border: 1px solid ${BRAND_GREEN}; }
  .metric-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
  .metric { background: ${ALT_ROW}; border-radius: 4px; padding: 10px 14px; min-width: 120px; }
  .metric-label { font-size: 10px; color: #666; text-transform: uppercase; }
  .metric-value { font-size: 16px; font-weight: bold; color: #222; }
  .footer { position: fixed; bottom: 10mm; left: 15mm; right: 15mm; font-size: 9px; color: #999; border-top: 1px solid #ddd; padding-top: 4px; display: flex; justify-content: space-between; }
  ul { padding-left: 20px; }
  li { margin-bottom: 4px; }
</style>
</head>
<body>
<div style="text-align:center;padding:30px 0 20px">
  <div style="width:60px;height:60px;background:${BRAND_GREEN};border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center">
    <span style="color:white;font-weight:bold;font-size:28px">H</span>
  </div>
  <h1>ALTREE — Habitainer Division</h1>
  <p style="color:#666;font-size:14px">Board Paper · ${sections.executive_summary?.period || reportDate}</p>
  <p style="color:#999;font-size:11px">Prepared: ${sections.executive_summary?.date_prepared} · By: ${sections.executive_summary?.prepared_by || '—'}</p>
  <p style="color:#999;font-size:10px;margin-top:4px">CONFIDENTIAL</p>
</div>

<h2>1. Executive Summary</h2>
<table>
  <tr><td style="padding:6px 10px;border:1px solid #ddd;width:30%;font-weight:bold">Company</td><td style="padding:6px 10px;border:1px solid #ddd">${sections.executive_summary?.company}</td></tr>
  <tr style="background:${ALT_ROW}"><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold">Division</td><td style="padding:6px 10px;border:1px solid #ddd">${sections.executive_summary?.division}</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold">Period</td><td style="padding:6px 10px;border:1px solid #ddd">${sections.executive_summary?.period}</td></tr>
</table>
${commentaryBlock("executive_summary")}

<h2>2. Project Portfolio Overview</h2>
<table>
  <thead><tr><th>Project</th><th>Modules</th><th>Contract Value</th><th>% Complete</th><th>Margin %</th><th>Status</th><th>Handover</th></tr></thead>
  <tbody>${projectRows}</tbody>
</table>
<div class="metric-grid">
  <div class="metric"><div class="metric-label">Active Projects</div><div class="metric-value">${sections.project_portfolio?.summary?.total_active || 0}</div></div>
  <div class="metric"><div class="metric-label">Total Value</div><div class="metric-value">${formatCurrency(sections.project_portfolio?.summary?.total_contract_value)}</div></div>
  <div class="metric"><div class="metric-label">Avg Margin</div><div class="metric-value">${sections.project_portfolio?.summary?.avg_margin || 0}%</div></div>
  <div class="metric"><div class="metric-label">On Track</div><div class="metric-value">${sections.project_portfolio?.summary?.on_track || 0}</div></div>
  <div class="metric"><div class="metric-label">Delayed</div><div class="metric-value" style="${(sections.project_portfolio?.summary?.delayed||0)>0?'color:red':''}">${sections.project_portfolio?.summary?.delayed || 0}</div></div>
</div>
${commentaryBlock("project_portfolio")}

<h2>3. Revenue & Collections</h2>
<div class="metric-grid">
  <div class="metric"><div class="metric-label">Revenue (Invoiced)</div><div class="metric-value">${formatCurrency(sections.revenue_collections?.total_revenue)}</div></div>
  <div class="metric"><div class="metric-label">Collections</div><div class="metric-value">${formatCurrency(sections.revenue_collections?.total_collections)}</div></div>
  <div class="metric"><div class="metric-label">Outstanding</div><div class="metric-value">${formatCurrency(sections.revenue_collections?.outstanding_receivables)}</div></div>
  <div class="metric"><div class="metric-label">Pipeline (90d)</div><div class="metric-value">${formatCurrency(sections.revenue_collections?.revenue_pipeline_90d)}</div></div>
  <div class="metric"><div class="metric-label">vs Previous</div><div class="metric-value">${sections.revenue_collections?.change_pct != null ? `${sections.revenue_collections.change_pct > 0 ? '↑' : '↓'} ${Math.abs(sections.revenue_collections.change_pct)}%` : 'N/A'}</div></div>
</div>
<table style="margin-top:12px">
  <thead><tr><th>Aging Bracket</th><th>Amount</th></tr></thead>
  <tbody>
    <tr><td style="padding:6px 10px;border:1px solid #ddd">0–30 days</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right">${formatCurrency(sections.revenue_collections?.aged_receivables?.["0_30"])}</td></tr>
    <tr style="background:${ALT_ROW}"><td style="padding:6px 10px;border:1px solid #ddd">31–60 days</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right">${formatCurrency(sections.revenue_collections?.aged_receivables?.["31_60"])}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #ddd">60+ days</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right">${formatCurrency(sections.revenue_collections?.aged_receivables?.["60_plus"])}</td></tr>
  </tbody>
</table>
${commentaryBlock("revenue_collections")}

<h2>4. Cost & Margin Analysis</h2>
<div class="metric-grid">
  <div class="metric"><div class="metric-label">Total Costs</div><div class="metric-value">${formatCurrency(sections.cost_margin?.total_costs)}</div></div>
  <div class="metric"><div class="metric-label">Blended Margin</div><div class="metric-value">${sections.cost_margin?.blended_margin || 0}%</div></div>
  <div class="metric"><div class="metric-label">Labour Cost</div><div class="metric-value">${formatCurrency(sections.cost_margin?.labour_cost)}</div></div>
  <div class="metric"><div class="metric-label">Material Cost</div><div class="metric-value">${formatCurrency(sections.cost_margin?.material_cost)}</div></div>
</div>
<table style="margin-top:12px">
  <thead><tr><th>Project</th><th>Margin %</th></tr></thead>
  <tbody>${marginRows}</tbody>
</table>
${commentaryBlock("cost_margin")}

<h2>5. Operational Metrics</h2>
<div class="metric-grid">
  <div class="metric"><div class="metric-label">In Production</div><div class="metric-value">${sections.operational_metrics?.modules_in_production || 0}</div></div>
  <div class="metric"><div class="metric-label">Dispatched</div><div class="metric-value">${sections.operational_metrics?.modules_dispatched || 0}</div></div>
  <div class="metric"><div class="metric-label">Total Modules</div><div class="metric-value">${sections.operational_metrics?.total_modules || 0}</div></div>
  <div class="metric"><div class="metric-label">NCRs Raised</div><div class="metric-value">${sections.operational_metrics?.ncr_raised || 0}</div></div>
  <div class="metric"><div class="metric-label">NCRs Closed</div><div class="metric-value">${sections.operational_metrics?.ncr_closed || 0}</div></div>
  <div class="metric"><div class="metric-label">NCRs Pending</div><div class="metric-value" style="${(sections.operational_metrics?.ncr_pending||0)>0?'color:red':''}">${sections.operational_metrics?.ncr_pending || 0}</div></div>
</div>
${commentaryBlock("operational_metrics")}

<h2>6. Sales Pipeline</h2>
<div class="metric-grid">
  <div class="metric"><div class="metric-label">New Leads</div><div class="metric-value">${sections.sales_pipeline?.new_leads || 0}</div></div>
  <div class="metric"><div class="metric-label">Won</div><div class="metric-value">${sections.sales_pipeline?.deals_won || 0} (${formatCurrency(sections.sales_pipeline?.deals_won_value)})</div></div>
  <div class="metric"><div class="metric-label">Lost</div><div class="metric-value">${sections.sales_pipeline?.deals_lost || 0} (${formatCurrency(sections.sales_pipeline?.deals_lost_value)})</div></div>
  <div class="metric"><div class="metric-label">Win Rate</div><div class="metric-value">${sections.sales_pipeline?.win_rate || 0}%</div></div>
  <div class="metric"><div class="metric-label">Pipeline Value</div><div class="metric-value">${formatCurrency(sections.sales_pipeline?.pipeline_value)}</div></div>
  <div class="metric"><div class="metric-label">Active Deals</div><div class="metric-value">${sections.sales_pipeline?.active_deals || 0}</div></div>
</div>
${commentaryBlock("sales_pipeline")}

<h2>7. Cashflow Position</h2>
<div class="metric-grid">
  <div class="metric"><div class="metric-label">Bank Balance</div><div class="metric-value">${formatCurrency(sections.cashflow?.bank_balance)}</div></div>
  <div class="metric"><div class="metric-label">Payables</div><div class="metric-value">${formatCurrency(sections.cashflow?.payables)}</div></div>
  <div class="metric"><div class="metric-label">Receivables</div><div class="metric-value">${formatCurrency(sections.cashflow?.receivables)}</div></div>
  <div class="metric"><div class="metric-label">Net Cash</div><div class="metric-value" style="${(sections.cashflow?.net_cash||0)<0?'color:red':''}">${formatCurrency(sections.cashflow?.net_cash)}</div></div>
</div>
${commentaryBlock("cashflow")}

<h2>8. Key Risks and Actions</h2>
<ul>${riskItems}</ul>
${commentaryBlock("risks")}

<h2>9. Upcoming Milestones (Next 60 Days)</h2>
<h3 style="color:#555;font-size:13px;margin-top:12px">Planned Dispatches</h3>
<ul>${dispatchItems}</ul>
<h3 style="color:#555;font-size:13px;margin-top:12px">Billing Milestones Due</h3>
<ul>${billingItems}</ul>
<h3 style="color:#555;font-size:13px;margin-top:12px">Statutory Filings Due</h3>
<ul>${statutoryItems}</ul>
${commentaryBlock("upcoming_milestones")}

<div class="footer">
  <span>CONFIDENTIAL — Habitainer Board Paper</span>
  <span>${sections.executive_summary?.date_prepared}</span>
</div>
</body>
</html>`;

    // Return HTML as a downloadable file (client will print-to-PDF or we return as HTML)
    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="Board_Paper_${reportDate}.html"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
