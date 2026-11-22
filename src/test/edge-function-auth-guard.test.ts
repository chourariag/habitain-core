import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import ts from "typescript";

const ALLOWLIST: Record<string, string> = {
  "kiosk-login": "Existing PIN credential flow; explicitly excluded from this prompt.",
  "tally-ingest": "Existing ingestion-key authentication; explicitly excluded.",
  "uptime-health-check": "Existing monitor handling; explicitly excluded.",
  "export-admin": "Existing checked user/role export helper; explicitly excluded.",
  "export-latest": "Existing hashed export-token helper; explicitly excluded.",
  "export-nightly": "Existing generated cron authenticator; explicitly excluded.",
};

function inspect(path: string, seen = new Set<string>()): { service: boolean; check: boolean } {
  if (seen.has(path)) return { service: false, check: false };
  seen.add(path);
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let service = false, check = false;
  const imported = new Map<string, string>();
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.startsWith(".")) {
      const target = resolve(dirname(path), statement.moduleSpecifier.text);
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach(e => imported.set(e.name.text, target));
    }
  }
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) && /SERVICE_ROLE/.test(node.text)) service = true;
    if (ts.isCallExpression(node)) {
      const fn = node.expression;
      if (ts.isPropertyAccessExpression(fn) && ["getUser", "getClaims"].includes(fn.name.text)) check = true;
      if (ts.isIdentifier(fn) && fn.text === "authenticateCronRequest") check = true;
      // Shared verified helpers count only when imported AND actually called.
      if (ts.isIdentifier(fn) && imported.has(fn.text)) {
        const target = imported.get(fn.text);
        if (target) { const nested = inspect(target, seen); service ||= nested.service; check ||= nested.check; }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { service, check };
}

describe("Every service-key Edge function verifies its caller", () => {
  for (const folder of readdirSync("supabase/functions", { withFileTypes: true }).filter(f => f.isDirectory() && f.name !== "_shared")) {
    it(`${folder.name}: authentication or explicit reviewed exception`, () => {
      const result = inspect(resolve("supabase/functions", folder.name, "index.ts"));
      expect(!result.service || result.check || Boolean(ALLOWLIST[folder.name]), `${folder.name} uses a service key without a verified caller`).toBe(true);
    });
  }
  it("does not mistake comments or strings for an authentication call", () => {
    const ast = ts.createSourceFile("fixture.ts", 'const note = "getUser authenticateCronRequest"; // getClaims()', ts.ScriptTarget.Latest, true);
    let calls = 0;
    const visit = (n: ts.Node) => { if (ts.isCallExpression(n)) calls++; ts.forEachChild(n, visit); };
    visit(ast); expect(calls).toBe(0);
  });
});