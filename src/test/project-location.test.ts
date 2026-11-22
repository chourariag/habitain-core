import { describe, expect, it } from "vitest";
import { canEditSiteLocation, emptySiteLocation, hasSitePin, normaliseClientPhone, outsideIndia, parseSitePin, validClientEmail, validateSiteLocation } from "@/lib/project-location";

describe("project contact validation", () => {
  it("normalises an Indian mobile with optional +91", () => {
    expect(normaliseClientPhone("9876543210")).toBe("+919876543210");
    expect(normaliseClientPhone("+91 98765 43210")).toBe("+919876543210");
  });
  it.each(["1234567890", "987654321", "+449876543210", "919876543210", "", "98765432100"])("rejects invalid Indian mobile %s", input => expect(normaliseClientPhone(input)).toBeNull());
  it("accepts a valid email", () => expect(validClientEmail("client@example.com")).toBe(true));
  it.each(["", "client@", "client@example", "client @example.com", "client@@example.com", "client@example..com"])("rejects invalid email %s", input => expect(validClientEmail(input)).toBe(false));
});
describe("site location rules", () => {
  const location = { ...emptySiteLocation(), location: "Bengaluru", site_lat: "12.9716", site_lng: "77.5946" };
  it("defaults to 300 metres", () => expect(emptySiteLocation().site_radius).toBe("300"));
  it("requires an address", () => expect(validateSiteLocation({ ...location, location: " " })).not.toBeNull());
  it.each([50, 300, 1000])("allows radius %i", radius => expect(validateSiteLocation({ ...location, site_radius: String(radius) })).toBeNull());
  it.each([49, 1001, 50.5, -1])("rejects radius %i", radius => expect(validateSiteLocation({ ...location, site_radius: String(radius) })).not.toBeNull());
  it.each([[91, 77], [-91, 77], [12, 181], [12, -181], [0, 0], [null, 77], [12, null], [NaN, 77], ["", 77]])("rejects invalid pin %s,%s", (lat, lng) => expect(hasSitePin(lat, lng)).toBe(false));
  it.each([[90, 180], [-90, -180], [0, 77], [12, 0], [12.9716, 77.5946]])("accepts valid pin %i,%i", (lat, lng) => expect(hasSitePin(lat, lng)).toBe(true));
  it("warns but does not block outside India", () => { expect(outsideIndia(51.5, -0.1)).toBe(true); expect(validateSiteLocation({ ...location, site_lat: "51.5", site_lng: "-0.1" })).toBeNull(); expect(outsideIndia(12.9716, 77.5946)).toBe(false); });
});
describe("pasted site pins", () => {
  it.each(["12.9716, 77.5946", "https://www.google.com/maps?q=12.9716,77.5946", "https://www.google.com/maps/search/?api=1&query=12.9716%2C77.5946", "https://www.google.com/maps/@12.9716,77.5946,15z", "https://www.google.com/maps/place/Site/data=!3d12.9716!4d77.5946"])("parses %s", input => expect(parseSitePin(input)).toEqual({ lat: 12.9716, lng: 77.5946 }));
  it.each(["0,0", "91,77", "https://evil.example/maps?q=12,77", "not a pin", "https://maps.app.goo.gl/short"])("rejects ambiguous or invalid pin %s", input => expect(parseSitePin(input)).toBeNull());
});
describe("site location edit roles", () => {
  it.each(["managing_director", "finance_director", "sales_director", "architecture_director", "super_admin", "head_of_projects"])("allows %s", role => expect(canEditSiteLocation(role)).toBe(true));
  it.each(["finance_manager", "project_architect", "site_installation_mgr", "sales_executive", "sales_associate", "marketing", "accounts_executive", "head_operations", "site_engineer", null])("denies %s", role => expect(canEditSiteLocation(role)).toBe(false));
});