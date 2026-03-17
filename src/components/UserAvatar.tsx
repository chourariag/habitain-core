import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export function UserAvatar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [initials, setInitials] = useState("U");

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
    <button
      type="button"
      onClick={() => navigate("/profile")}
      className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm hover:ring-2 ring-primary/30 transition-all shrink-0"
      title="Profile"
    >
      {initials}
    </button>
  );
}
