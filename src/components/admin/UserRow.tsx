import { useState } from "react";
import { Tables } from "@/integrations/supabase/types";
import { ROLE_LABELS, AppRole, ROLE_TIERS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Shield, ShieldOff, UserCog } from "lucide-react";
import { toast } from "sonner";
import { deactivateUser, reactivateUser, updateUserRole } from "@/lib/admin-api";

interface UserRowProps {
  profile: Tables<"profiles">;
  onUpdate: () => void;
}

export function UserRow({ profile, onUpdate }: UserRowProps) {
  const [changingRole, setChangingRole] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleDeactivate = async () => {
    setActionLoading(true);
    try {
      await deactivateUser(profile.auth_user_id);
      toast.success(`${profile.display_name || profile.email} deactivated`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await reactivateUser(profile.auth_user_id);
      toast.success(`${profile.display_name || profile.email} reactivated`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    setActionLoading(true);
    try {
      await updateUserRole(profile.auth_user_id, newRole as AppRole);
      toast.success(`Role updated to ${ROLE_LABELS[newRole as AppRole]}`);
      setChangingRole(false);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isActive = profile.is_active !== false;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border transition-snappy ${!isActive ? "opacity-60" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-card-foreground truncate">
            {profile.display_name || "—"}
          </p>
          {!isActive && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inactive</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
        {profile.phone && (
          <p className="text-xs text-muted-foreground">{profile.phone}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {changingRole ? (
          <Select
            defaultValue={profile.role}
            onValueChange={handleRoleChange}
          >
            <SelectTrigger className="w-48 bg-background text-foreground text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card text-card-foreground max-h-64">
              {Object.entries(ROLE_TIERS).map(([tier, roles]) => (
                <SelectGroup key={tier}>
                  <SelectLabel className="text-[10px] text-muted-foreground">{tier}</SelectLabel>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            {ROLE_LABELS[profile.role] || profile.role}
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setChangingRole(!changingRole)}
          title="Change role"
        >
          <UserCog className="h-4 w-4" />
        </Button>

        {isActive ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Deactivate" disabled={actionLoading}>
                <ShieldOff className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card text-card-foreground">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Deactivate User</AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately revoke access for <strong>{profile.display_name || profile.email}</strong>. Their data will be preserved for audit purposes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground">
                  Deactivate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={handleReactivate} disabled={actionLoading} title="Reactivate">
            <Shield className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
