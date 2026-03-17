import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createUser } from "@/lib/admin-api";
import { AppRole, ROLE_TIERS, ROLE_LABELS, KIOSK_ROLES } from "@/lib/roles";

interface AddUserDialogProps {
  onUserCreated: () => void;
}

export function AddUserDialog({ onUserCreated }: AddUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [kioskPin, setKioskPin] = useState("");
  const [loading, setLoading] = useState(false);

  const isKiosk = role && KIOSK_ROLES.includes(role as AppRole);
  const loginType = isKiosk ? "otp" : "email";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !role) {
      toast.error("Email and role are required");
      return;
    }
    if (isKiosk && (!kioskPin || kioskPin.length !== 4)) {
      toast.error("Set a 4-digit PIN for kiosk users");
      return;
    }
    setLoading(true);
    try {
      const result = await createUser(email, role as AppRole, loginType, phone || undefined, isKiosk ? kioskPin : undefined);
      toast.success("User created successfully", {
        description: result.invite_link
          ? "Invite link generated. Share it with the user."
          : `Temporary password: ${result.temp_password}`,
        duration: 15000,
      });
      setEmail("");
      setPhone("");
      setRole("");
      setKioskPin("");
      setOpen(false);
      onUserCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card text-card-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input
              type="email"
              placeholder="user@altree.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger className="bg-background text-foreground">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent className="bg-card text-card-foreground max-h-64">
                {Object.entries(ROLE_TIERS).map(([tier, roles]) => (
                  <SelectGroup key={tier}>
                    <SelectLabel className="text-xs text-muted-foreground font-semibold">{tier}</SelectLabel>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isKiosk && (
            <div className="space-y-2">
              <Label>Phone Number (for OTP login)</Label>
              <Input
                type="tel"
                placeholder="+91XXXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-background text-foreground"
              />
            </div>
          )}

          {isKiosk && (
            <div className="space-y-2">
              <Label>4-Digit Kiosk PIN</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="1234"
                value={kioskPin}
                onChange={(e) => setKioskPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
                className="bg-background text-foreground tracking-widest text-center text-lg"
              />
              <p className="text-xs text-muted-foreground">
                This PIN will be used by the worker to log in at the kiosk.
              </p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create User & Send Invite"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
