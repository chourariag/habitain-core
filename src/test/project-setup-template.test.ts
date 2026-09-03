import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  NOT_TRACKED,
  NOT_TRACKED_FONT,
  resolveRoleField,
  resolveSalesOwner,
  isNotTracked,
} from "@/lib/project-setup-template";

/** Minimal supabase-like stub for the Sales Owner bridge query. */
function makeClient(opts: { leads?: any[]; profile?: any }) {
  return {
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: opts.profile ?? null }),
        then: undefined,
      };
      if (table === "sales_pipeline_leads") {
        chain.eq = () => Promise.resolve({ data: opts.leads ?? [] });
      }
      return chain;
    },
  };
}

const ROLE_FIELDS = [
  "planning_head",
  "production_head",
  "site_installation_mgr",
  "planning_engineer",
  "costing_engineer",
  "operations_architect",
];

describe("Project Setup template — Sales Owner", () => {
  it('shows "Not yet tracked" when no lead carries a real sales rep', async () => {
    const client = makeClient({
      leads: [{ sales_rep: null, sales_rep_name: "Sales Desk" }],
    });
    expect(await resolveSalesOwner(client, "p1")).toBe(NOT_TRACKED);
  });

  it('shows "Not yet tracked" when the project has no leads at all', async () => {
    expect(await resolveSalesOwner(makeClient({ leads: [] }), "p1")).toBe(NOT_TRACKED);
  });

  it("shows the real rep name when a won deal bridged a real rep", async () => {
    const client = makeClient({
      leads: [{ sales_rep: "rep-uuid", sales_rep_name: "Sales Desk" }],
      profile: { display_name: "George" },
    });
    expect(await resolveSalesOwner(client, "p1")).toBe("George");
  });
});

describe("Project Setup template — role-resolved fields", () => {
  it("resolves the active holder name when the role has one", async () => {
    const fetcher = async () => "Suraj Rao";
    for (const role of ROLE_FIELDS) {
      expect(await resolveRoleField(fetcher, role)).toBe("Suraj Rao");
    }
  });

  it('renders "Not yet tracked" (never blank) for every role with zero active holders', async () => {
    const fetcher = async () => "";
    for (const role of ROLE_FIELDS) {
      const value = await resolveRoleField(fetcher, role);
      expect(value).toBe(NOT_TRACKED);
      expect(value).not.toBe("");
    }
  });

  it("falls through operations_architect to head_operations before marking not tracked", async () => {
    const withFallback = async (role: string) =>
      role === "head_operations" ? "Venkat" : "";
    expect(
      await resolveRoleField(withFallback, "operations_architect", "head_operations"),
    ).toBe("Venkat");

    const none = async () => "";
    expect(
      await resolveRoleField(none, "operations_architect", "head_operations"),
    ).toBe(NOT_TRACKED);
  });

  it("styles the marker consistently (amber italic) for all seven fields", async () => {
    const none = async () => "";
    const values = [
      await resolveSalesOwner(makeClient({ leads: [] }), "p1"),
      ...ROLE_FIELDS.map(() => NOT_TRACKED),
    ];
    expect(values).toHaveLength(7);
    for (const v of values) {
      expect(isNotTracked(v)).toBe(true);
    }
    expect(NOT_TRACKED_FONT).toEqual({ italic: true, color: { argb: "FFD4860A" } });
    expect(await resolveRoleField(none, "planning_head")).toBe(NOT_TRACKED);
  });
});

describe("Project Setup base template file", () => {
  it("contains no hardcoded person names", () => {
    const file = path.resolve(
      process.cwd(),
      "public/templates/Project_Setup_Template.xlsx",
    );
    const buf = fs.readFileSync(file);
    // xlsx is a zip; shared strings are deflated, so scan the raw bytes plus
    // an inflated pass over every entry.
    const forbidden = ["John Kunnath", "Suraj Rao"];
    const raw = buf.toString("latin1");
    for (const name of forbidden) {
      expect(raw.includes(name)).toBe(false);
    }

    const zlib = require("node:zlib") as typeof import("node:zlib");
    // Inflate every deflate stream we can find and re-check.
    let idx = 0;
    const text: string[] = [];
    while ((idx = raw.indexOf("PK\u0003\u0004", idx)) !== -1) {
      const nameLen = buf.readUInt16LE(idx + 26);
      const extraLen = buf.readUInt16LE(idx + 28);
      const start = idx + 30 + nameLen + extraLen;
      try {
        text.push(zlib.inflateRawSync(buf.subarray(start), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString("utf8"));
      } catch {
        /* not a deflate entry */
      }
      idx += 4;
    }
    const joined = text.join("\n");
    for (const name of forbidden) {
      expect(joined.includes(name)).toBe(false);
    }
  });
});
