import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { KPI_VISIBLE_ROLES } from "@/lib/kpi-helpers";

export function KPIRouteGuard({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }
      const { data: role } = await supabase.rpc("get_user_role", { _user_id: user.id });
      if (KPI_VISIBLE_ROLES.includes(role as string)) {
        setAllowed(true);
      } else {
        navigate("/dashboard", { replace: true });
      }
    })();
  }, [navigate]);

  if (allowed === null) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return <>{children}</>;
}
