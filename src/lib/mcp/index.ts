import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import whoamiTool from "./tools/whoami";

// The OAuth issuer MUST be the direct Supabase host — never the .lovable.cloud
// proxy — because mcp-js validates the token's issuer against the direct host
// published by Supabase's discovery document. Build it from the project ref,
// which Vite inlines at build time as a literal, keeping this module
// import-safe (no runtime env read at module top level).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hstack-mcp",
  title: "HStack",
  version: "0.1.0",
  instructions:
    "Tools for the HStack operations platform. Use `whoami` to confirm the signed-in user, `list_projects` to browse projects, and `get_project` to fetch a single project. All access respects HStack's role and row-level security rules.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listProjectsTool, getProjectTool],
});
