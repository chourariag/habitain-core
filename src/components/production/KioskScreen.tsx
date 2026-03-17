import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface KioskScreenProps {
  onExit: () => void;
}

const TRADES = [
  "Fabrication",
  "Welding",
  "Electrical",
  "Plumbing",
  "Insulation",
  "Cladding",
  "Finishing",
];

type KioskStep = "phone" | "otp" | "work";

export function KioskScreen({ onExit }: KioskScreenProps) {
  const [step, setStep] = useState<KioskStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<Tables<"modules">[]>([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    if (step === "work") {
      supabase
        .from("modules")
        .select("*")
        .eq("is_archived", false)
        .order("name")
        .then(({ data }) => setModules(data ?? []));
    }
  }, [step]);

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      toast.error("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone.replace(/\D/g, "").slice(-10)}` });
      if (error) throw error;
      toast.success("OTP sent!");
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: `+91${phone.replace(/\D/g, "").slice(-10)}`,
        token: otp,
        type: "sms",
      });
      if (error) throw error;
      toast.success("Verified!");
      setStep("work");
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async () => {
    if (!selectedModule || !selectedTrade) {
      toast.error("Select module and trade");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("labour_claims").insert({
        module_id: selectedModule,
        trade: selectedTrade,
        worker_id: user.id,
        quantity: Number(quantity) || 1,
        work_description: workDescription || null,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Work logged successfully!");
      setSelectedModule("");
      setSelectedTrade("");
      setWorkDescription("");
      setQuantity("1");
    } catch (err: any) {
      toast.error(err.message || "Failed to log work");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onExit}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-bold text-foreground">Labour Kiosk</h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">

          {/* Step: Phone */}
          {step === "phone" && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="font-display text-2xl font-bold text-foreground">Enter Phone Number</h2>
                <p className="text-muted-foreground">We'll send you an OTP to verify</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-foreground shrink-0">+91</span>
                <Input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-lg h-14 text-center tracking-widest"
                  maxLength={10}
                />
              </div>
              <Button size="lg" className="w-full h-14 text-lg" onClick={handleSendOtp} disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send OTP"}
              </Button>
            </div>
          )}

          {/* Step: OTP */}
          {step === "otp" && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="font-display text-2xl font-bold text-foreground">Enter OTP</h2>
                <p className="text-muted-foreground">Sent to +91 {phone}</p>
              </div>
              <Input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="text-2xl h-16 text-center tracking-[0.5em]"
                maxLength={6}
              />
              <Button size="lg" className="w-full h-14 text-lg" onClick={handleVerifyOtp} disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("phone")}>Change number</Button>
            </div>
          )}

          {/* Step: Work */}
          {step === "work" && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                <h2 className="font-display text-2xl font-bold text-foreground">Log Work</h2>
              </div>

              <div className="space-y-2">
                <label className="text-base font-medium text-foreground">Module</label>
                <Select value={selectedModule} onValueChange={setSelectedModule}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-base py-3">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-base font-medium text-foreground">Trade</label>
                <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADES.map((t) => (
                      <SelectItem key={t} value={t} className="text-base py-3">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-base font-medium text-foreground">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-14 text-base"
                />
              </div>

              <div className="space-y-2">
                <label className="text-base font-medium text-foreground">Description (optional)</label>
                <Input
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="What did you work on?"
                  className="h-14 text-base"
                />
              </div>

              <Button
                size="lg"
                className="w-full h-16 text-xl font-bold mt-4"
                onClick={handleStartWork}
                disabled={loading || !selectedModule || !selectedTrade}
              >
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "START WORK"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
