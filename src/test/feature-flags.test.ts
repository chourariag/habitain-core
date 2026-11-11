import { describe, expect, it } from "vitest";
import { FEATURE_FLAG_DEFINITIONS } from "@/lib/feature-flags";

describe("feature flag rollout defaults", () => {
  it("enables only the ten modules selected for the first rollout", () => {
    const enabled = FEATURE_FLAG_DEFINITIONS.filter((flag) => flag.enabled).map((flag) => flag.key).sort();
    expect(enabled).toEqual([
      "attendance",
      "expenses",
      "exports",
      "labour",
      "procurement",
      "project_setup",
      "projects",
      "reminders",
      "site_report",
      "user_admin",
    ]);
  });

  it("assigns the requested wave-two and wave-three groups", () => {
    const waveTwo = FEATURE_FLAG_DEFINITIONS.filter((flag) => flag.wave === 2).map((flag) => flag.key).sort();
    const waveThree = FEATURE_FLAG_DEFINITIONS.filter((flag) => flag.wave === 3).map((flag) => flag.key).sort();
    expect(waveTwo).toEqual(["advances", "compliance", "equipment", "factory_feedback", "holidays", "inventory", "leave", "training"]);
    expect(waveThree).toEqual(["client_work_orders", "design_fees", "design_schedule", "gfc", "work_orders"]);
  });
});