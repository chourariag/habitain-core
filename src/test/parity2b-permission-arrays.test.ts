import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { TIER1_ROLES } from "@/lib/roles";
import { TIER1_ROLES as EDGE_TIER1, uniqueRecipientIds, uniqueByAuthUser } from "../../supabase/functions/_shared/director-tier";

// Explicit non-permission exceptions: labels, pickers, onboarding copy, role identities.
const NON_PERMISSION_FILES = new Set([
  "src/lib/roles.ts", "src/lib/hstack-users.ts",
  "src/components/super-admin/CreateAccountsTab.tsx", "src/pages/EmployeeManagement.tsx",
  "src/components/RoleSwitcher.tsx", "src/pages/Onboarding.tsx",
]);
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === "src/test" || path === "src/integrations" ? [] : files(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}
describe("director permission array parity", () => {
  it("has no incomplete MD permission arrays", () => {
    const violations: string[] = [];
    for (const file of files("src")) {
      if (NON_PERMISSION_FILES.has(file)) continue;
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isArrayLiteralExpression(node)) {
          const roles = node.elements.filter(ts.isStringLiteral).map(value => value.text);
          const spreadsTier = node.elements.some(value => ts.isSpreadElement(value) && ["TIER1_ROLES", "TIER1_OR_SUPER_ROLES"].includes(value.expression.getText(source)));
          if (roles.includes("managing_director") && !spreadsTier && !TIER1_ROLES.every(role => roles.includes(role))) {
            violations.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(violations).toEqual([]);
  });
  it("keeps Edge and frontend Tier 1 identical", () => expect(EDGE_TIER1).toEqual(TIER1_ROLES));
  it("sends one notification per holder", () => {
    expect(uniqueRecipientIds(["one", "two", "one", ""])).toEqual(["one", "two"]);
    expect(uniqueByAuthUser([{ auth_user_id: "one" }, { auth_user_id: "one" }, { auth_user_id: "two" }])).toHaveLength(2);
  });
});