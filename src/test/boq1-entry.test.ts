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
});