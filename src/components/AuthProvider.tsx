import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  // One-time subscription — no dependencies that change
  useEffect(() => {
    let mounted = true;

    const handleSession = async (nextSession: Session | null) => {
      if (!mounted) return;

      if (!nextSession) {
        setSession(null);
        setLoading(false);
        return;
      }

      // Validate profile is_active (non-blocking on failure)
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("auth_user_id", nextSession.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          return;
        }
      } catch {
        // Continue with session if profile check fails
      }

      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          setSession(null);
          setLoading(false);
          if (!PUBLIC_ROUTES.includes(locationRef.current)) {
            navigate("/login", { replace: true });
          }
          return;
        }

        await handleSession(nextSession);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      handleSession(existing);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect unauthenticated users away from protected routes
  useEffect(() => {
    if (!loading && !session && !PUBLIC_ROUTES.includes(location.pathname)) {
      navigate("/login", { replace: true });
    }
  }, [loading, session, location.pathname, navigate]);

  // Redirect authenticated users away from public routes
  useEffect(() => {
    if (!loading && session && PUBLIC_ROUTES.includes(location.pathname)) {
      navigate("/dashboard", { replace: true });
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
