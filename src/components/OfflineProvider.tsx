import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ConnectionStatus = "online" | "offline";

const OfflineContext = createContext<ConnectionStatus>("online");

export const useConnectionStatus = () => useContext(OfflineContext);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(
    navigator.onLine ? "online" : "offline"
  );

  useEffect(() => {
    const goOnline = () => setStatus("online");
    const goOffline = () => setStatus("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <OfflineContext.Provider value={status}>{children}</OfflineContext.Provider>
  );
}
