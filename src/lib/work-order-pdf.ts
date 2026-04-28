import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface Args {
  wo: any;
  sub: any;
  project: any;
  issuerName: string;
}

const fmtINR = (n: number) => `Rs. ${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export async function generateWorkOrderPdf({ wo, sub, project, issuerName }: Args): Promise<string> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 50;

  // Header
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(`WORK ORDER — ${wo.wo_number}`, pageWidth / 2, y, { align: "center" }); y += 18;
  doc.setLineWidth(0.5).line(40, y, pageWidth - 40, y); y += 18;

  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("Alternate Real Estate Experiences Pvt Ltd", 40, y); y += 12;
  doc.setFont("helvetica", "normal");
  doc.text("6A/6C Peenya Industrial Area Phase 1, Bangalore 560058", 40, y); y += 12;
  doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, 40, y); y += 18;

  // To
  doc.setFont("helvetica", "bold").text("To:", 40, y); y += 12;
  doc.setFont("helvetica", "normal");
  doc.text(`${sub?.company_name ?? sub?.contact_person ?? ""}`, 40, y); y += 12;
  if (sub?.contact_person && sub?.company_name) { doc.text(`Attn: ${sub.contact_person}`, 40, y); y += 12; }
  if (sub?.phone) { doc.text(`Phone: ${sub.phone}`, 40, y); y += 12; }
  if (sub?.email) { doc.text(`Email: ${sub.email}`, 40, y); y += 12; }
  y += 6;

  // Project
  doc.setFont("helvetica", "bold");
  doc.text(`Project: `, 40, y); doc.setFont("helvetica", "normal"); doc.text(`${project?.name ?? ""}`, 90, y); y += 12;
  doc.setFont("helvetica", "bold").text(`Location: `, 40, y); doc.setFont("helvetica", "normal"); doc.text(`${wo.location_area}`, 95, y); y += 12;
  doc.setFont("helvetica", "bold").text(`WO Reference: `, 40, y); doc.setFont("helvetica", "normal"); doc.text(`${wo.wo_number}`, 125, y); y += 18;

  // Scope
  doc.setFont("helvetica", "bold").text("SCOPE OF WORK:", 40, y); y += 12;
  doc.setFont("helvetica", "normal");
  const scopeLines = doc.splitTextToSize(wo.scope_of_work, pageWidth - 80);
  doc.text(scopeLines, 40, y); y += scopeLines.length * 12 + 8;

  // Measurement & rate
  const totalEx = Number(wo.total_value);
  const gst = totalEx * 0.18;
  const totalIn = totalEx + gst;
  doc.setFont("helvetica", "bold").text("MEASUREMENT AND RATE:", 40, y); y += 12;
  doc.setFont("helvetica", "normal");
  doc.text(`Measurement Basis: ${wo.measurement_basis}`, 40, y); y += 12;
  doc.text(`Quantity: ${wo.quantity} ${wo.unit ?? ""}`, 40, y); y += 12;
  doc.text(`Rate: Rs. ${wo.rate} per ${wo.unit ?? ""}`, 40, y); y += 12;
  doc.text(`Total Work Order Value (excl. GST): ${fmtINR(totalEx)}`, 40, y); y += 12;
  doc.text(`GST @ 18%: ${fmtINR(gst)}`, 40, y); y += 12;
  doc.setFont("helvetica", "bold").text(`Total Value (incl. GST): ${fmtINR(totalIn)}`, 40, y); y += 18;

  // Timeline
  doc.setFont("helvetica", "bold").text("TIMELINE:", 40, y); y += 12;
  doc.setFont("helvetica", "normal");
  doc.text(`Planned Start Date: ${format(new Date(wo.planned_start_date), "dd/MM/yyyy")}`, 40, y); y += 12;
  doc.text(`Planned Completion Date: ${format(new Date(wo.planned_completion_date), "dd/MM/yyyy")}`, 40, y); y += 18;

  // Payment
  doc.setFont("helvetica", "bold").text("PAYMENT TERMS:", 40, y); y += 12;
  doc.setFont("helvetica", "normal");
  const ptLines = doc.splitTextToSize("Payment will be made within 7 working days of completion and measurement sign-off by the designated site/factory in-charge.", pageWidth - 80);
  doc.text(ptLines, 40, y); y += ptLines.length * 12 + 8;

  // Terms
  doc.setFont("helvetica", "bold").text("TERMS AND CONDITIONS:", 40, y); y += 12;
  doc.setFont("helvetica", "normal");
  const terms = [
    "1. Work must be completed as per drawings and finish schedule provided.",
    "2. Any deviation from scope requires written approval before execution.",
    "3. Workmanship defects found during inspection must be rectified at no additional cost.",
    "4. Site safety rules must be followed at all times.",
    "5. ALTREE reserves the right to deduct cost of rectification from payment if defects are not fixed within 48 hours of notice.",
  ];
  for (const t of terms) {
    const ln = doc.splitTextToSize(t, pageWidth - 80);
    doc.text(ln, 40, y); y += ln.length * 12;
  }
  y += 12;

  if (y > 700) { doc.addPage(); y = 50; }
  doc.setFont("helvetica", "bold").text("Authorised by:", 40, y); y += 12;
  doc.setFont("helvetica", "normal").text(`${issuerName} — Finance & Administration`, 40, y); y += 12;
  doc.text("Alternate Real Estate Experiences Pvt Ltd", 40, y); y += 30;
  doc.text("Acknowledged by:", 40, y); y += 36;
  doc.line(40, y, 250, y); y += 12;
  doc.text(`${sub?.contact_person ?? ""}`, 40, y); y += 12;
  doc.text("Date: ____________________", 40, y);

  // Upload
  const blob = doc.output("blob");
  const path = `work-orders/${wo.id}.pdf`;
  // Try drawings bucket (public). Fall back to data URL if upload fails.
  try {
    const { error } = await supabase.storage.from("drawings").upload(path, blob, { upsert: true, contentType: "application/pdf" });
    if (error) throw error;
    const { data } = supabase.storage.from("drawings").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return doc.output("datauristring");
  }
}
