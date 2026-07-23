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

// Allowed columns per data type. Keys are snake_case DB columns; values list
// accepted incoming field aliases so both snake_case and camelCase payloads map.
const ALLOWED_FIELDS: Record<string, Record<string, string[]>> = {
  trial_balance: {
    ledger_name: ["ledger_name", "ledgerName"],
    group_name: ["group_name", "groupName"],
    opening_balance: ["opening_balance", "openingBalance"],
    debit: ["debit"],
    credit: ["credit"],
    closing_balance: ["closing_balance", "closingBalance"],
    as_of_date: ["as_of_date", "asOfDate"],
  },
  purchase_orders: {
    po_number: ["po_number", "poNumber"],
    po_date: ["po_date", "poDate"],
    vendor_name: ["vendor_name", "vendorName"],
    item_name: ["item_name", "itemName"],
    quantity: ["quantity"],
    rate: ["rate"],
    amount: ["amount"],
    due_date: ["due_date", "dueDate"],
    status: ["status"],
  },
  purchase_order_register: {
    po_number: ["po_number", "poNumber"],
    po_date: ["po_date", "poDate"],
    vendor_name: ["vendor_name", "vendorName"],
    total_amount: ["total_amount", "totalAmount"],
    status: ["status"],
    last_updated: ["last_updated", "lastUpdated"],
  },
  grn: {
    grn_number: ["grn_number", "grnNumber"],
    grn_date: ["grn_date", "grnDate"],
    po_number: ["po_number", "poNumber"],
    vendor_name: ["vendor_name", "vendorName"],
    item_name: ["item_name", "itemName"],
    quantity_received: ["quantity_received", "quantityReceived"],
    quantity_ordered: ["quantity_ordered", "quantityOrdered"],
    remarks: ["remarks"],
  },
  sales_vouchers: {
    invoice_number: ["invoice_number", "invoiceNumber"],
    invoice_date: ["invoice_date", "invoiceDate"],
    customer_name: ["customer_name", "customerName"],
    item_name: ["item_name", "itemName"],
    quantity: ["quantity"],
    rate: ["rate"],
    amount: ["amount"],
    total_amount: ["total_amount", "totalAmount"],
    status: ["status"],
  },
  purchase_invoices: {
    bill_number: ["bill_number", "billNumber"],
    bill_date: ["bill_date", "billDate"],
    vendor_name: ["vendor_name", "vendorName"],
    po_number: ["po_number", "poNumber"],
    amount: ["amount"],
    outstanding_amount: ["outstanding_amount", "outstandingAmount"],
    due_date: ["due_date", "dueDate"],
  },
  vendor_ledgers: {
    vendor_name: ["vendor_name", "vendorName"],
    ledger_group: ["ledger_group", "ledgerGroup"],
    opening_balance: ["opening_balance", "openingBalance"],
    total_billed: ["total_billed", "totalBilled"],
    total_paid: ["total_paid", "totalPaid"],
    outstanding_balance: ["outstanding_balance", "outstandingBalance"],
    ageing_bucket: ["ageing_bucket", "ageingBucket"],
  },
  customer_ledgers: {
    customer_name: ["customer_name", "customerName"],
    ledger_group: ["ledger_group", "ledgerGroup"],
    opening_balance: ["opening_balance", "openingBalance"],
    total_invoiced: ["total_invoiced", "totalInvoiced"],
    total_received: ["total_received", "totalReceived"],
    outstanding_balance: ["outstanding_balance", "outstandingBalance"],
    ageing_bucket: ["ageing_bucket", "ageingBucket"],
  },
  bank_book: {
    bank_ledger_name: ["bank_ledger_name", "bankLedgerName"],
    transaction_date: ["transaction_date", "transactionDate"],
    voucher_type: ["voucher_type", "voucherType"],
    narration: ["narration"],
    debit: ["debit"],
    credit: ["credit"],
    running_balance: ["running_balance", "runningBalance"],
  },
  cash_book: {
    transaction_date: ["transaction_date", "transactionDate"],
    voucher_type: ["voucher_type", "voucherType"],
    narration: ["narration"],
    debit: ["debit"],
    credit: ["credit"],
    running_balance: ["running_balance", "runningBalance"],
  },
  cost_centre_data: {
    cost_centre_name: ["cost_centre_name", "costCentreName"],
    ledger_name: ["ledger_name", "ledgerName"],
    voucher_type: ["voucher_type", "voucherType"],
    amount: ["amount"],
    transaction_date: ["transaction_date", "transactionDate"],
    period: ["period"],
  },
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
    for (const [dbCol, aliases] of Object.entries(allowed)) {
      for (const alias of aliases) {
        if (rec[alias] !== undefined) {
          row[dbCol] = rec[alias] === "" ? null : rec[alias];
          break;
        }
      }
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
