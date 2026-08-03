import { useRoleHolders } from "@/hooks/useRoleHolders";

/**
 * Shows the actual named person(s) responsible for a pending action.
 * Visible to Super Admin / MD only — every other role renders nothing.
 */
export function ResponsiblePerson({
  roles,
  prefix = "—",
  className = "",
}: {
  roles: string | string[] | null | undefined;
  prefix?: string;
  className?: string;
}) {
  const { namesFor } = useRoleHolders();
  const names = namesFor(roles);
  if (!names) return null;
  const vacant = names === "unassigned";
  return (
    <span
      className={`text-xs ${vacant ? "italic" : ""} ${className}`}
      style={{ color: vacant ? "#F40009" : "#006039" }}
      title={vacant ? "No active user holds this role" : "Responsible person (visible to Super Admin / MD)"}
    >
      {prefix} {names}
    </span>
  );
}
