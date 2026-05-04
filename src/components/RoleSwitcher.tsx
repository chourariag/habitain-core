import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useUserRole } from "@/hooks/useUserRole";
import { FlaskConical, Search, Check } from "lucide-react";
import { HSTACK_USERS, HSTACK_USER_GROUPS } from "@/lib/hstack-users";
import { ROLE_LABELS } from "@/lib/roles";

// Stored as `${role}|${name}` so multiple users sharing a role (e.g. Sharan/George)
// are distinct in the dropdown. Only the role portion is applied to the override.
function parseSelection(v: string | null): { role: string | null; name: string | null } {
  if (!v) return { role: null, name: null };
  const [role, name] = v.split("|");
  return { role: role || null, name: name || null };
}

export function roleLabel(roleValue: string | null): string {
  if (!roleValue) return "Unknown";
  return ROLE_LABELS[roleValue] ?? roleValue;
}

interface Props {
  collapsed?: boolean;
}

export function RoleSwitcher({ collapsed }: Props) {
  const { actualRole, role, canImpersonate, setOverrideRole } = useUserRole();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const currentRole = role ?? actualRole ?? "managing_director";
  const currentUser =
    HSTACK_USERS.find((u) => u.role === currentRole) ??
    { name: "Managing Director", role: currentRole, group: "" };

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HSTACK_USER_GROUPS.map((group) => {
      const users = HSTACK_USERS.filter((u) => u.group === group).filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          (ROLE_LABELS[u.role] ?? "").toLowerCase().includes(q)
        );
      });
      return { group, users };
    }).filter((g) => g.users.length > 0);
  }, [query]);

  function selectUser(role: string, name: string) {
    if (role === actualRole) setOverrideRole(null);
    else setOverrideRole(role, name);
    setOpen(false);
    setQuery("");
  }

  if (!canImpersonate) return null;

  if (collapsed) {
    return (
      <div className="flex items-center justify-center py-2" title="Testing Mode">
        <FlaskConical className="h-4 w-4" style={{ color: "#D4860A" }} />
      </div>
    );
  }

  return (
    <div
      className="px-3 py-2 mx-2 my-2 rounded-md"
      style={{ backgroundColor: "#FFF8EC", border: "1px solid #F4D58A" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <FlaskConical className="h-3 w-3" style={{ color: "#D4860A" }} />
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#D4860A" }}>
          Testing Mode
        </span>
      </div>
      <label className="text-[10px] block mb-1" style={{ color: "#666666" }}>
        View as User:
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full h-8 text-xs px-2 rounded border bg-white text-left truncate"
            style={{ borderColor: "#F4D58A" }}
          >
            <span className="font-medium">{currentUser.name}</span>
            <span className="text-muted-foreground"> · {roleLabel(currentRole)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or role…"
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {filteredGroups.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">No matches</div>
            )}
            {filteredGroups.map(({ group, users }) => (
              <div key={group} className="py-1">
                <div className="px-3 py-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {group}
                </div>
                {users.map((u) => {
                  const isCurrent = u.role === currentRole;
                  return (
                    <button
                      key={`${u.role}|${u.name}`}
                      type="button"
                      onClick={() => selectUser(u.role, u.name)}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {roleLabel(u.role)}
                        </div>
                      </div>
                      {isCurrent && <Check className="h-3.5 w-3.5 text-[#006039] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
