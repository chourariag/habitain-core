import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OVERVIEW_POLL_MS, type SiteOverviewData } from "@/lib/site-overview";

export function useSiteOverview(date: string) {
  const [data, setData] = useState<SiteOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [visible, setVisible] = useState(() => !document.hidden);
  const generation = useRef(0);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const scope = generation.current;
    const sequence = ++request.current;
    const { data: value, error: failure } = await supabase.rpc("get_site_overview", { p_date: date });
    if (scope !== generation.current || sequence !== request.current) return;
    setLoading(false);
    if (failure) { setError(failure.message); return; }
    setData(value as unknown as SiteOverviewData);
    setError(null);
    setUpdatedAt(new Date().toISOString());
  }, [date]);
  useEffect(() => {
    generation.current++;
    setData(null); setError(null); setUpdatedAt(null); setLoading(true);
    if (!document.hidden) void refresh();
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { timer = setInterval(() => { if (!document.hidden) void refresh(); }, OVERVIEW_POLL_MS); };
    const changed = () => {
      setVisible(!document.hidden);
      if (timer) clearInterval(timer);
      if (!document.hidden) { void refresh(); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", changed);
    return () => { generation.current++; if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", changed); };
  }, [refresh]);
  return { data, error, loading, updatedAt, visible, refresh };
}