import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Setup() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkUsers() {
      try {
        const { data, error } = await supabase.functions.invoke("bootstrap-admin", {
          body: { action: "check" },
        });
        if (error) throw error;
        if (data?.has_users) {
          navigate("/login", { replace: true });
        }
      } catch {
        toast.error("Unable to check setup status");
        navigate("/login", { replace: true });
      } finally {
        setChecking(false);
      }
    }
    checkUsers();
  }, [navigate]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-admin", {
        body: { action: "create", email, password, display_name: displayName },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Admin account created! You can now sign in.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl mb-4">
            H
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Initial Setup</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create the Managing Director account
          </p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div className="bg-card rounded-lg p-6 space-y-4 shadow-lg">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-card-foreground">Full Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-card-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@altree.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-card-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-card-foreground">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-background text-foreground border-border"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create Admin Account"}
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          This page is only available for initial setup when no users exist.
        </p>
      </div>
    </div>
  );
}
