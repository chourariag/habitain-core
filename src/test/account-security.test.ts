import { describe, expect, it, vi, afterEach } from "vitest";
import { webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generatePassword, passwordPolicyError, roleGrantError } from "../../supabase/functions/_shared/password-policy";

afterEach(() => vi.restoreAllMocks());
const directors = ["managing_director", "finance_director", "sales_director", "architecture_director"];
describe("Account security policy", () => {
  it("rejects a chosen password under 10 characters", async () => {
    expect(await passwordPolicyError("short1234")).toBe("Password must be at least 10 characters");
  });
  it("accepts a chosen password of 10 characters", async () => {
    vi.stubGlobal("crypto", webcrypto);
    expect(await passwordPolicyError("LongEnough1")).toBeNull();
  });
  it("rejects the retired fingerprint without storing or printing its credential", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const source = readFileSync("supabase/functions/_shared/password-policy.ts", "utf8");
    const fingerprints = source.match(/[a-f0-9]{64}/g) || [];
    expect(fingerprints.length).toBe(2);
    for (const fingerprint of fingerprints) {
      vi.spyOn(crypto.subtle, "digest").mockResolvedValueOnce(Uint8Array.from(fingerprint.match(/../g) || [], s => parseInt(s, 16)).buffer);
      expect(await passwordPolicyError("CandidateForFingerprintCheck")).toBe("The retired default cannot be used");
    }
  });
  it("generates independent cryptographic passwords at least 16 characters long", () => {
    vi.stubGlobal("crypto", webcrypto);
    const passwords = Array.from({ length: 100 }, () => generatePassword());
    expect(new Set(passwords).size).toBe(100);
    expect(passwords.every(p => p.length >= 16)).toBe(true);
  });
  it("allows Super Admin to grant Super Admin", () => {
    expect(roleGrantError(["super_admin"], "caller", "other", "super_admin")).toBeNull();
  });
  for (const role of directors) {
    it(`${role} cannot grant Super Admin`, () => {
      expect(roleGrantError([role], "caller", "other", "super_admin")).toBe("Only Super Admin may grant or revoke Super Admin");
    });
    it(`${role} can grant site engineer`, () => {
      expect(roleGrantError([role], "caller", "other", "site_engineer")).toBeNull();
    });
    it(`${role} cannot revoke Super Admin`, () => {
      expect(roleGrantError([role], "caller", "other", "site_engineer", ["super_admin"])).toBe("Only Super Admin may grant or revoke Super Admin");
    });
  }
  for (const role of ["super_admin", ...directors]) {
    it(`${role} cannot change their own role`, () => {
      expect(roleGrantError([role], "self", "self", "site_engineer")).toBe("Cannot change your own role");
    });
  }
  it("refuses last-Super-Admin demotion", () => {
    expect(roleGrantError(["super_admin"], "caller", "last", "site_engineer", ["super_admin"], true)).toBe("Cannot demote the last Super Admin");
  });
  it("rejects non-director grant authority", () => {
    expect(roleGrantError(["site_engineer"], "caller", "other", "site_engineer")).toBe("Director access required");
  });
  it("repository contains no retired credential in the three requested folders", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const fingerprints = new Set(readFileSync("supabase/functions/_shared/password-policy.ts", "utf8").match(/[a-f0-9]{64}/g));
    function files(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
    }
    let matches = 0;
    for (const folder of ["src", "supabase", "drizzle"]) {
      for (const file of files(folder)) {
        // Check complete string tokens; never include source or credentials in failure output.
        const text = readFileSync(file, "utf8");
        for (const candidate of text.matchAll(/["'`]([^"'`\r\n]*)["'`]/g)) {
          const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(candidate[1]));
          const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
          if (fingerprints.has(hash)) matches++;
        }
      }
    }
    expect(matches).toBe(0);
  }, 30000);
  it("retired initial-admin endpoint has no remaining source or config references", () => {
    const name = ["bootstrap", "admin"].join("-");
    const check = (dir: string): number => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? check(join(dir, e.name)) : Number(readFileSync(join(dir, e.name), "utf8").includes(name))), 0);
    expect(check("src") + check("supabase") + check("drizzle")).toBe(0);
  });
});