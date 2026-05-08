import { StageChecklistDrawer } from "@/components/production/StageChecklistDrawer";
import { SITE_STAGES } from "@/lib/hstack-stages";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectName?: string;
  initialStageName?: string;
  userRole: string | null;
  userId: string | null;
}

const SIM_EDITOR_ROLES = [
  "site_installation_mgr", "site_engineer", "delivery_rm_lead",
  "super_admin", "managing_director", "head_operations",
];

export function SiteStageChecklistDrawer(props: Props) {
  return (
    <StageChecklistDrawer
      {...props}
      stages={SITE_STAGES}
      editorRoles={SIM_EDITOR_ROLES}
      scopeLabel="Site"
    />
  );
}
