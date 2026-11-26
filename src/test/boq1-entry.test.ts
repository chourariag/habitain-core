import { describe, expect, it } from "vitest";
import { mapBoqPaste, parseBoqPaste } from "@/lib/boq-entry";

describe("Client BOQ paste entry", () => {
  it("preserves client descriptions with quoted tabs and embedded newlines", () => {
    const rows = parseBoqPaste('1\t"Panel\tA\nclient finish"\tsqm\t10\t100\tStructure\tFactory\tfactory');
    expect(mapBoqPaste(rows, [0,1,2,3,4,5,6,7], false).rows[0].item_description).toBe("Panel\tA\nclient finish");
  });
  it("preserves all rows when one pasted row lacks a mapped field", () => {
    const result = mapBoqPaste([["1","Panel","sqm","2","3","Structure","Factory","factory"],["2","Incomplete"]], [0,1,2,3,4,5,6,7], false);
    expect(result.rows).toHaveLength(2);
    expect(result.issues).toEqual(["Row 2: a mapped column is missing."]);
    expect(result.rows[0].boq_rate).toBe("3");
  });
  it("keeps repeated headings selectable by column position", () => {
    const result = mapBoqPaste([["No","Description","Unit","Value","Value","Category","Scope","Location"],["1","Panel","sqm","12","45","Structure","Factory","factory"]], [0,1,2,3,4,5,6,7], true);
    expect(result.rows[0].boq_qty).toBe("12"); expect(result.rows[0].boq_rate).toBe("45");
  });
  it("rejects malformed quoted cells rather than consuming partial input", () => {
    expect(() => parseBoqPaste('1\t"unclosed')).toThrow();
  });
  it("rejects inputs over 500 rows explicitly", () => {
    expect(() => mapBoqPaste(Array.from({length:501}, () => Array(8).fill("1")), [0,1,2,3,4,5,6,7], false)).toThrow("500");
  });
  it.each(["Factory", "FACTORY", " factory "])("accepts and canonicalises pasted work location %s", location => {
    const result = mapBoqPaste([["1", "Panel", "sqm", "2", "3", "Structure", "Factory", location]], [0,1,2,3,4,5,6,7], false, ["Factory"]);
    expect(result.rows[0].work_location).toBe("factory");
    expect(result.issues).toEqual([]);
  });
  it("matches scope case-insensitively and returns the Add row form's canonical value", () => {
    const result = mapBoqPaste([["1", "Panel", "sqm", "2", "3", "Structure", " factory ", "site"]], [0,1,2,3,4,5,6,7], false, ["Both", "Factory", "Habitainer", "On-Site Civil"]);
    expect(result.rows[0].scope).toBe("Factory");
    expect(result.issues).toEqual([]);
  });
  it("lists the valid scopes when a pasted scope is not recognised", () => {
    const result = mapBoqPaste([["1", "Panel", "sqm", "2", "3", "Structure", "Foo", "site"]], [0,1,2,3,4,5,6,7], false, ["Both", "Factory", "Habitainer", "On-Site Civil"]);
    expect(result.issues).toContain("Row 1: Scope 'Foo' is not valid. Use: Both, Factory, Habitainer, On-Site Civil.");
  });
  it("lists the valid work locations when a pasted location is not recognised", () => {
    const result = mapBoqPaste([["1", "Panel", "sqm", "2", "3", "Structure", "Factory", "warehouse"]], [0,1,2,3,4,5,6,7], false, ["Factory"]);
    expect(result.issues).toContain("Row 1: Work location 'warehouse' is not valid. Use: site, factory.");
  });
});