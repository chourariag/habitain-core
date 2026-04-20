import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  status: string | null;
  production_system: string | null;
}

interface ProjectContextType {
  projects: Project[];
  selectedProjectId: string | null;
  selectedProject: Project | null;
  setSelectedProjectId: (id: string | null) => void;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  selectedProjectId: null,
  selectedProject: null,
  setSelectedProjectId: () => {},
  loading: true,
});

export function useProjectContext() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectIdRaw] = useState<string | null>(() => {
    try { return sessionStorage.getItem("selectedProjectId"); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const setSelectedProjectId = useCallback((id: string | null) => {
    setSelectedProjectIdRaw(id);
    try {
      if (id) sessionStorage.setItem("selectedProjectId", id);
      else sessionStorage.removeItem("selectedProjectId");
    } catch {}
  }, []);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,name,client_name,status,production_system")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      setProjects((data as Project[] | null) ?? []);
      setLoading(false);
    };
    fetch();

    const ch = supabase
      .channel("project-ctx")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <ProjectContext.Provider value={{ projects, selectedProjectId, selectedProject, setSelectedProjectId, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}
