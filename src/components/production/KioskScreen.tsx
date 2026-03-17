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

interface KioskProfile {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  role: string;
  phone: string | null;
  email: string | null;
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

type KioskStep = "phone" | "pin" | "work";

const KIOSK_SESSION_KEY = "kiosk_session";

function getKioskSession(): KioskProfile | null {
  try {
    const raw = localStorage.getItem(KIOSK_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setKioskSession(profile: KioskProfile) {
  localStorage.setItem(KIOSK_SESSION_KEY, JSON.stringify(profile));
}

function clearKioskSession() {
  localStorage.removeItem(KIOSK_SESSION_KEY);
}

export function KioskScreen({ onExit }: KioskScreenProps) {
  const existing = getKioskSession();
  const [step, setStep] = useState<KioskStep>(existing ? "work" : "phone");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [kioskProfile, setKioskProfile] = useState<KioskProfile | null>(existing);
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

  const handlePhoneNext = () => {
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    setStep("pin");
  };

  const handleVerifyPin = async () => {
    if (pin.length !== 4) {
      toast.error("Enter your 4-digit PIN");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("kiosk-login", {
        body: { phone: phone.replace(/\D/g, "").slice(-10), pin },
      });

      if (error) throw new Error(error.message || "Login failed");
      if (data?.error) throw new Error(data.error);

      const profile: KioskProfile = data.profile;
      setKioskSession(profile);
      setKioskProfile(profile);
      toast.success(`Welcome, ${profile.display_name || "Worker"}!`);
      setStep("work");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearKioskSession();
    setKioskProfile(null);
    setPhone("");
    setPin("");
    setStep("phone");
  };

  const handleStartWork = async () => {
    if (!selectedModule || !selectedTrade) {
      toast.error("Select module and trade");
      return;
    }
    if (!kioskProfile) {
      toast.error("Session expired. Please log in again.");
      handleLogout();
      return;
    }
    setLoading(true);
    try {
      // Use the auth_user_id from the kiosk profile for the worker_id
      const { error } = await supabase.from("labour_claims").insert({
        module_id: selectedModule,
        trade: selectedTrade,
        worker_id: kioskProfile.auth_user_id,
        quantity: Number(quantity) || 1,
        work_description: workDescription || null,
        created_by: kioskProfile.auth_user_id,
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
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => { clearKioskSession(); onExit(); }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-bold text-foreground">Labour Kiosk</h1>
        {kioskProfile && (
          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={handleLogout}>
            Logout
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">

          {step === "phone" && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="font-display text-2xl font-bold text-foreground">Enter Phone Number</h2>
                <p className="text-muted-foreground">Enter your registered phone number</p>
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
              <Button size="lg" className="w-full h-14 text-lg" onClick={handlePhoneNext}>
                Next
              </Button>
            </div>
          )}

          {step === "pin" && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="font-display text-2xl font-bold text-foreground">Enter PIN</h2>
                <p className="text-muted-foreground">4-digit PIN for +91 {phone}</p>
              </div>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-3xl h-16 text-center tracking-[0.5em]"
                maxLength={4}
              />
              <Button size="lg" className="w-full h-14 text-lg" onClick={handleVerifyPin} disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
              </Button>
              <Button variant="ghost" onClick={() => { setStep("phone"); setPin(""); }}>Change number</Button>
            </div>
          )}

          {step === "work" && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                <h2 className="font-display text-2xl font-bold text-foreground">Log Work</h2>
                {kioskProfile?.display_name && (
                  <p className="text-muted-foreground text-sm">Logged in as {kioskProfile.display_name}</p>
                )}
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
