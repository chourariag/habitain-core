import { describe, expect, it } from "vitest";
import { hasRequiredAttendanceLocation } from "@/lib/attendance-location";

describe("mandatory GPS attendance location", () => {
  it("accepts coordinates and rejects check-ins without both GPS coordinates", () => {
    expect(hasRequiredAttendanceLocation(12.9716, 77.5946)).toBe(true);
    expect(hasRequiredAttendanceLocation(null, 77.5946)).toBe(false);
    expect(hasRequiredAttendanceLocation(12.9716, null)).toBe(false);
    expect(hasRequiredAttendanceLocation(null, null)).toBe(false);
  });
});