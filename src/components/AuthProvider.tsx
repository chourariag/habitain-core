import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

const PUBLIC_ROUTES = ["/login", "/setup", "/welcome"];

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const validateSession = useCallback(
    async (nextSession: Session | null) => {
      if (!nextSession) {
        setSession(null);
        setLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("auth_user_id", nextSession.user.id)
          .maybeSingle();

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          return;
        }
      } catch {
        // If profile validation fails temporarily, keep the current session
      }

      setSession(nextSession);
      setLoading(false);

      if (PUBLIC_ROUTES.includes(location.pathname)) {
        navigate("/dashboard", { replace: true });
      }
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        if (!PUBLIC_ROUTES.includes(location.pathname)) {
          navigate("/login", { replace: true });
        }
        return;
      }

      await validateSession(nextSession);
    });

    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      await validateSession(existingSession);
    });

    const interval = window.setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      await validateSession(currentSession);
    }, 5 * 60 * 1000);

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      await validateSession(currentSession);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [location.pathname, navigate, validateSession]);

  useEffect(() => {
    if (!loading && !session && !PUBLIC_ROUTES.includes(location.pathname)) {
      navigate("/login", { replace: true });
    }
  }, [loading, session, location.pathname, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm animate-pulse">
          H
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
