import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { LogOut, Lock, User } from "lucide-react";

export function UserAvatar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [initials, setInitials] = useState("U");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name || user.email || "U";
        const parts = name.split(/[\s@]+/).slice(0, 2);
        setInitials(parts.map((w: string) => w[0]?.toUpperCase()).join(""));
      });
  }, [user]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm hover:ring-2 ring-primary/30 transition-all shrink-0"
            title="Account"
          >
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate("/profile")}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
            <Lock className="mr-2 h-4 w-4" />
            Change Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
}
