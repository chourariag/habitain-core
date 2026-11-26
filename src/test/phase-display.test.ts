import { describe, expect, it } from "vitest";
import { displayPhaseFor, getPhasesForSystem, OTHER_PHASE } from "@/lib/production-phases";

describe("Actuals phase view mapping (display only)", () => {
  it("maps library 'factory'/'site' to the system's phases", () => {
    const mod = getPhasesForSystem("modular");
    expect(displayPhaseFor("factory", "modular", mod)).toBe("Factory Production");
    expect(displayPhaseFor("site", "hybrid", getPhasesForSystem("hybrid"))).toBe("Site Installation");
    const pan = getPhasesForSystem("panelised");
    expect(displayPhaseFor("factory", "panelised", pan)).toBe("Panel Production");
    expect(displayPhaseFor("site", "panelised", pan)).toBe("Site Erection");
  });
  it("puts every unknown phase in Other so column totals equal the task count", () => {
    const mod = getPhasesForSystem("modular");
    const phases = ["Design", "factory", "site", "weird", "", "Handover"];
    const cols = new Set([...mod, OTHER_PHASE]);
    phases.forEach((p) => expect(cols.has(displayPhaseFor(p, "modular", mod))).toBe(true));
    expect(displayPhaseFor("weird", "modular", mod)).toBe(OTHER_PHASE);
  });
});
