import { supabase } from "@/integrations/supabase/client";

/**
 * Real task engine for sales roles (sales_executive / sales_associate / sales_director).
 * Derives open gates, uploads and approvals from live data — no placeholders.
 */

export type SalesTaskUrgency = "overdue" | "action" | "waiting";

export interface SalesTask {
  id: string;
  groupKey: string;      // project id, or "pipeline"
  groupLabel: string;    // project name, or "Sales Pipeline"
  title: string;
  detail?: string;
  to: string;            // route to complete it
  urgency: SalesTaskUrgency;
  actionable: boolean;   // false = waiting on someone else
  ownerLabel?: string;   // who is blocking, when not actionable
}

const db = supabase as any;

const ACTIVE_PROJECT_EXCLUDE = ["closed", "archived", "cancelled"];

const PORTAL_TOKEN_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "planning_head"];

// Roles that can actually sign / approve on behalf of the sales function.
const SALES_APPROVER_ROLES = ["sales_director", "managing_director", "super_admin"];

export async function fetchSalesTasks(authUserId: string | null, role?: string | null): Promise<SalesTask[]> {
  const canSeePortalTokens = PORTAL_TOKEN_ROLES.includes(role ?? "");
  const isApprover = SALES_APPROVER_ROLES.includes(role ?? "");
  const tasks: SalesTask[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // Resolve profile id (sales_deals.assigned_to may store either profile id or auth id)
  let profileId: string | null = null;
  if (authUserId) {
    const { data: prof } = await db
      .from("profiles").select("id").eq("auth_user_id", authUserId).maybeSingle();
    profileId = prof?.id ?? null;
  }
  const meIds = [profileId, authUserId].filter(Boolean) as string[];

  const [projRes, scopeRes, contractRes, tokenRes, varRes, dealRes] = await Promise.all([
    db.from("projects").select("id, name, status, is_archived, type").eq("is_archived", false),
    db.from("project_scope_of_work").select("id, project_id, status, client_signed_at, sales_director_signed_at"),
    db.from("contracts_register").select("id, project_id, contract_type, contract_file_url, is_archived")
      .eq("contract_type", "Sale Agreement"),
    canSeePortalTokens
      ? db.from("client_portal_tokens").select("id, project_id, is_active, expires_at")
      : Promise.resolve({ data: [] }),
    db.from("project_variations").select("id, project_id, variation_number, status, description"),
    // A Sales Director owns the whole pipeline, not just deals assigned to them.
    isApprover
      ? db.from("sales_deals").select("id, client_name, stage, assigned_to, next_followup_date, updated_at, is_archived, adjustment_type, discount_approved_at")
          .eq("is_archived", false)
      : meIds.length
        ? db.from("sales_deals").select("id, client_name, stage, assigned_to, next_followup_date, updated_at, is_archived, adjustment_type, discount_approved_at")
            .in("assigned_to", meIds).eq("is_archived", false)
        : Promise.resolve({ data: [] }),
  ]);


  const projects = (projRes.data ?? []).filter(
    (p: any) => !ACTIVE_PROJECT_EXCLUDE.includes(String(p.status ?? "").toLowerCase())
  );
  const scopes = scopeRes.data ?? [];
  const contracts = (contractRes.data ?? []).filter((c: any) => !c.is_archived);
  const tokens = tokenRes.data ?? [];
  const variations = varRes.data ?? [];
  const deals = dealRes.data ?? [];

  for (const p of projects) {
    const g = { groupKey: p.id, groupLabel: p.name as string };
    const scopeUrl = `/projects/${p.id}?tab=scope`;
    const scope = scopes.find((s: any) => s.project_id === p.id);
    const isAds = String(p.type ?? "").toLowerCase().includes("ads");

    // 1 — Scope of Work
    if (!isAds) {
      if (!scope) {
        tasks.push({ ...g, id: `sow-new-${p.id}`, title: "Create Scope of Work",
          detail: "No scope of work started for this project", to: scopeUrl,
          urgency: "action", actionable: true });
      } else if (scope.status === "draft") {
        tasks.push({ ...g, id: `sow-draft-${p.id}`, title: "Complete & submit Scope of Work for sign-off",
          detail: "Scope is still in draft", to: scopeUrl, urgency: "action", actionable: true });
      } else if (scope.status !== "signed") {
        if (!scope.client_signed_at) {
          tasks.push({ ...g, id: `sow-client-${p.id}`, title: "Get client sign-off on Scope of Work",
            detail: "Send / follow up the client sign-off link", to: scopeUrl,
            urgency: "action", actionable: true });
        }
        if (!scope.sales_director_signed_at) {
          tasks.push({ ...g, id: `sow-sd-${p.id}`,
            title: isApprover ? "Sign off Scope of Work (Sales Director)" : "Scope awaiting Sales Director signature",
            detail: isApprover ? "Your signature is required to complete the scope" : undefined,
            to: scopeUrl, urgency: isApprover ? "action" : "waiting",
            actionable: isApprover, ownerLabel: "Sales Director" });
        }

      }

      // 2 — Sale Agreement (gated on signed scope)
      const contract = contracts.find((c: any) => c.project_id === p.id);
      if (scope?.status === "signed" && (!contract || !contract.contract_file_url)) {
        tasks.push({ ...g, id: `sale-agr-${p.id}`, title: "Upload signed Sale Agreement",
          detail: "Scope of Work is signed — agreement upload is now due", to: scopeUrl,
          urgency: "overdue", actionable: true });
      }
    }

    // 3 — Client portal magic link
    const activeToken = tokens.find(
      (t: any) => t.project_id === p.id && t.is_active !== false &&
        (!t.expires_at || new Date(t.expires_at) > new Date())
    );
    if (canSeePortalTokens && !activeToken) {
      tasks.push({ ...g, id: `portal-${p.id}`, title: "Generate client portal access link",
        detail: "Client has no active portal link", to: `/projects/${p.id}`,
        urgency: "action", actionable: true });
    }

    // 4 — Variations routed to sales (approval sits with the Sales Director)
    for (const v of variations.filter((v: any) => v.project_id === p.id && v.status === "Pending Scope Review")) {
      tasks.push({ ...g, id: `var-${v.id}`,
        title: isApprover
          ? `Approve variation ${v.variation_number} — scope review`
          : `Variation ${v.variation_number} — pending scope review`,
        detail: v.description ?? undefined, to: `/projects/${p.id}?tab=variations`,
        urgency: isApprover ? "action" : "waiting", actionable: isApprover, ownerLabel: "Sales Director" });
    }
  }


  // 5 — Pipeline tasks (deals assigned to me)
  const wonDealIds = deals.filter((d: any) => d.stage === "Won").map((d: any) => d.id);
  let checklists: any[] = [];
  if (wonDealIds.length) {
    const { data } = await db.from("sales_handover_checklists")
      .select("deal_id, completed").in("deal_id", wonDealIds);
    checklists = data ?? [];
  }
  const stagnantCutoff = new Date(Date.now() - 14 * 86400000);

  for (const d of deals) {
    const g = { groupKey: "pipeline", groupLabel: "Sales Pipeline" };
    if (d.next_followup_date && d.next_followup_date <= today && !["Won", "Lost"].includes(d.stage)) {
      tasks.push({ ...g, id: `fu-${d.id}`,
        title: `Follow up ${d.client_name}`,
        detail: d.next_followup_date < today ? "Follow-up overdue" : "Follow-up due today",
        to: "/sales", urgency: d.next_followup_date < today ? "overdue" : "action", actionable: true });
    }
    if (!["Won", "Lost"].includes(d.stage) && new Date(d.updated_at) < stagnantCutoff) {
      tasks.push({ ...g, id: `stag-${d.id}`, title: `${d.client_name} — no movement in 14+ days`,
        detail: `Stage: ${d.stage}`, to: "/sales", urgency: "action", actionable: true });
    }
    if (d.stage === "Won") {
      const cl = checklists.find((c: any) => c.deal_id === d.id);
      if (!cl?.completed) {
        tasks.push({ ...g, id: `hoc-${d.id}`, title: `Complete handover checklist — ${d.client_name}`,
          detail: "Required before project handover to operations", to: "/sales",
          urgency: "overdue", actionable: true });
      }
    }
  }

  const rank: Record<SalesTaskUrgency, number> = { overdue: 0, action: 1, waiting: 2 };
  return tasks.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}

export function groupSalesTasks(tasks: SalesTask[]) {
  const map = new Map<string, { label: string; items: SalesTask[] }>();
  for (const t of tasks) {
    if (!map.has(t.groupKey)) map.set(t.groupKey, { label: t.groupLabel, items: [] });
    map.get(t.groupKey)!.items.push(t);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v }));
}
