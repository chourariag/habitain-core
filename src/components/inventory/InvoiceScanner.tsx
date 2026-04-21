import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Camera, RotateCcw, Check, HelpCircle } from "lucide-react";
import { toast } from "sonner";

interface ExtractedData {
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  line_items: { description: string; quantity: number; unit: string; rate: number; amount: number }[];
  subtotal: number | null;
  gst_amount: number | null;
  total_amount: number | null;
}

interface Props {
  onExtracted: (data: ExtractedData) => void;
  onSkip: () => void;
}

export function InvoiceScanner({ onExtracted, onSkip }: Props) {
  const [scanning, setScanning] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setScanning(true);
    setError(null);
    setExtracted(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.split(",")[1];
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error: fnError } = await supabase.functions.invoke("scan-invoice", {
        body: { image_base64: base64, mime_type: file.type || "image/jpeg" },
      });

      if (fnError) throw new Error(fnError.message || "Scan failed");
      if (data?.error) throw new Error(data.error);

      if (data?.extracted) {
        setExtracted(data.extracted);
      } else {
        setError("Could not read invoice — please fill in manually");
      }
    } catch (err: any) {
      console.error("Invoice scan error:", err);
      setError(err.message || "Could not read invoice — please fill in manually");
    } finally {
      setScanning(false);
    }
  }, []);

  const triggerUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  const confirmExtraction = () => {
    if (extracted) {
      onExtracted(extracted);
      toast.success("Invoice data loaded into form");
    }
  };

  const FieldStatus = ({ value, label }: { value: any; label: string }) => (
    <div className="flex items-center gap-1.5 text-xs">
      {value != null ? (
        <Check className="h-3 w-3 shrink-0" style={{ color: "#006039" }} />
      ) : (
        <HelpCircle className="h-3 w-3 shrink-0" style={{ color: "#D4860A" }} />
      )}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value ?? "Not detected"}</span>
    </div>
  );

  if (extracted) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-display font-semibold" style={{ color: "#006039" }}>
            AI extracted the following — please verify before saving
          </p>
          <div className="space-y-1.5">
            <FieldStatus value={extracted.vendor_name} label="Vendor" />
            <FieldStatus value={extracted.invoice_number} label="Invoice No" />
            <FieldStatus value={extracted.invoice_date} label="Date" />
            <FieldStatus value={extracted.line_items?.length ? `${extracted.line_items.length} items` : null} label="Line Items" />
            <FieldStatus value={extracted.subtotal != null ? `₹${extracted.subtotal.toLocaleString("en-IN")}` : null} label="Subtotal" />
            <FieldStatus value={extracted.gst_amount != null ? `₹${extracted.gst_amount.toLocaleString("en-IN")}` : null} label="GST" />
            <FieldStatus value={extracted.total_amount != null ? `₹${extracted.total_amount.toLocaleString("en-IN")}` : null} label="Total" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmExtraction}>
              <Check className="h-3.5 w-3.5 mr-1" /> Use This Data
            </Button>
            <Button size="sm" variant="outline" onClick={triggerUpload}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rescan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#D4860A" }} />
            <div>
              <p className="text-xs font-medium" style={{ color: "#D4860A" }}>{error}</p>
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={triggerUpload}>
                <RotateCcw className="h-3 w-3 mr-1" /> Rescan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={triggerUpload} disabled={scanning}
          style={{ borderColor: "#006039", color: "#006039" }}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
          {scanning ? "Scanning…" : "Scan Invoice"}
        </Button>
        <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground underline">
          Fill Manually
        </button>
      </div>
    </div>
  );
}
