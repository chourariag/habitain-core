// Tally → HStack incoming ingestion endpoint.
// POST /functions/v1/tally-ingest
// Auth: X-API-Key header (checked against SHA-256 of active keys in tally_api_keys).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DATA_TYPE_TABLE: Record<string, string> = {
  trial_balance: "tally_trial_balance",
  purchase_orders: "tally_purchase_orders",
  purchase_order_register: "tally_purchase_order_register",
  grn: "tally_grn",
  sales_vouchers: "tally_sales_vouchers",
  purchase_invoices: "tally_purchase_invoices",
  vendor_ledgers: "tally_vendor_ledgers",
  customer_ledgers: "tally_customer_ledgers",
  bank_book: "tally_bank_book",
  cash_book: "tally_cash_book",
  cost_centre_data: "tally_cost_centre_data",
};

// Allowed columns per data type (snake_case fields sent by Tally client).
const ALLOWED_FIELDS: Record<string, string[]> = {
  trial_balance: ["ledger_name","group_name","opening_balance","debit","credit","closing_balance","as_of_date"],
  purchase_orders: ["po_number","po_date","vendor_name","item_name","quantity","rate","amount","due_date","status"],
  purchase_order_register: ["po_number","po_date","vendor_name","total_amount","status","last_updated"],
  grn: ["grn_number","grn_date","po_number","vendor_name","item_name","quantity_received","quantity_ordered","remarks"],
  sales_vouchers: ["invoice_number","invoice_date","customer_name","item_name","quantity","rate","amount","total_amount","status"],
  purchase_invoices: ["bill_number","bill_date","vendor_name","po_number","amount","outstanding_amount","due_date"],
  vendor_ledgers: ["vendor_name","ledger_group","opening_balance","total_billed","total_paid","outstanding_balance","ageing_bucket"],
  customer_ledgers: ["customer_name","ledger_group","opening_balance","total_invoiced","total_received","outstanding_balance","ageing_bucket"],
  bank_book: ["bank_ledger_name","transaction_date","voucher_type","narration","debit","credit","running_balance"],
  cash_book: ["transaction_date","voucher_type","narration","debit","credit","running_balance"],
  cost_centre_data: ["cost_centre_name","ledger_name","voucher_type","amount","transaction_date","period"],
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function jsonResp(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ status: "error", message: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // --- 1. API key check ---
  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!apiKey) {
    return jsonResp({ status: "error", message: "Invalid or missing API key" }, 401);
  }
  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow } = await admin
    .from("tally_api_keys")
    .select("id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!keyRow || keyRow.revoked_at) {
    return jsonResp({ status: "error", message: "Invalid or missing API key" }, 401);
  }
  admin.from("tally_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});

  // --- 2. Parse body ---
  let body: any;
  try { body = await req.json(); }
  catch { return jsonResp({ status: "error", message: "Invalid JSON body" }, 400); }

  const { dataType, companyName, batchId, syncTimestamp, records } = body ?? {};

  if (!dataType || typeof dataType !== "string" || !DATA_TYPE_TABLE[dataType]) {
    return jsonResp({ status: "error", message: `Invalid or unsupported dataType. Allowed: ${Object.keys(DATA_TYPE_TABLE).join(", ")}` }, 400);
  }
  if (!batchId || typeof batchId !== "string") {
    return jsonResp({ status: "error", message: "batchId is required" }, 400);
  }
  if (!Array.isArray(records)) {
    return jsonResp({ status: "error", message: "records must be an array" }, 400);
  }

  const tableName = DATA_TYPE_TABLE[dataType];
  const allowed = ALLOWED_FIELDS[dataType];

  // --- 3. Idempotency check ---
  const { count: dupCount } = await admin
    .from(tableName)
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);

  if ((dupCount ?? 0) > 0) {
    await admin.from("tally_ingest_log").insert({
      data_type: dataType, company_name: companyName ?? null, batch_id: batchId,
      sync_timestamp: syncTimestamp ?? null, record_count: 0, status: "duplicate",
      source_ip: sourceIp,
    });
    return jsonResp({ status: "success", recordsProcessed: 0, message: "Duplicate batch, already processed" }, 200);
  }

  // --- 4. Build rows with whitelisted columns only ---
  const rows: any[] = [];
  for (const rec of records) {
    if (!rec || typeof rec !== "object") {
      await admin.from("tally_ingest_log").insert({
        data_type: dataType, company_name: companyName ?? null, batch_id: batchId,
        sync_timestamp: syncTimestamp ?? null, record_count: 0, status: "failed",
        error_message: "Each record must be an object", source_ip: sourceIp,
      });
      return jsonResp({ status: "error", message: "Each record must be an object" }, 400);
    }
    const row: Record<string, unknown> = {
      company_name: companyName ?? null,
      batch_id: batchId,
      sync_timestamp: syncTimestamp ?? null,
    };
    for (const f of allowed) {
      if (rec[f] !== undefined) row[f] = rec[f] === "" ? null : rec[f];
    }
    rows.push(row);
  }

  // --- 5. Insert ---
  if (rows.length > 0) {
    const { error: insertErr } = await admin.from(tableName).insert(rows);
    if (insertErr) {
      await admin.from("tally_ingest_log").insert({
        data_type: dataType, company_name: companyName ?? null, batch_id: batchId,
        sync_timestamp: syncTimestamp ?? null, record_count: rows.length, status: "failed",
        error_message: insertErr.message, source_ip: sourceIp,
      });
      return jsonResp({ status: "error", message: `Insert failed: ${insertErr.message}` }, 400);
    }
  }

  await admin.from("tally_ingest_log").insert({
    data_type: dataType, company_name: companyName ?? null, batch_id: batchId,
    sync_timestamp: syncTimestamp ?? null, record_count: rows.length, status: "success",
    source_ip: sourceIp,
  });

  return jsonResp({ status: "success", recordsProcessed: rows.length }, 200);
});
