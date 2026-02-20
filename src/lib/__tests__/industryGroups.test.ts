import { describe, it, expect } from "vitest";
import { getIndustryGroup, ACTIVITY_TO_GROUP } from "../industryGroups";

describe("getIndustryGroup", () => {
  it("maps carpentry_joinery to construction", () => {
    expect(getIndustryGroup("carpentry_joinery")).toBe("construction");
  });

  it("maps software_development to software_dev", () => {
    expect(getIndustryGroup("software_development")).toBe("software_dev");
  });

  it("maps null to professional (default)", () => {
    expect(getIndustryGroup(null)).toBe("professional");
  });

  it("maps undefined to professional (default)", () => {
    expect(getIndustryGroup(undefined)).toBe("professional");
  });

  it("maps unknown string to professional (default)", () => {
    expect(getIndustryGroup("underwater_basket_weaving")).toBe("professional");
  });

  it("maps legacy enum hospitality to hospitality", () => {
    expect(getIndustryGroup("hospitality")).toBe("hospitality");
  });

  it("maps cafe_restaurant to hospitality", () => {
    expect(getIndustryGroup("cafe_restaurant")).toBe("hospitality");
  });

  it("maps haulage_hgv to transport", () => {
    expect(getIndustryGroup("haulage_hgv")).toBe("transport");
  });

  it("maps manufacturing to manufacturing", () => {
    expect(getIndustryGroup("manufacturing")).toBe("manufacturing");
  });
});

describe("ACTIVITY_TO_GROUP completeness", () => {
  it("has no duplicate values that contradict", () => {
    // Ensure every key maps to a valid group
    const validGroups = new Set([
      "construction", "technology", "software_dev", "events",
      "hospitality", "retail", "transport", "health",
      "property", "manufacturing", "professional",
    ]);
    for (const [key, group] of Object.entries(ACTIVITY_TO_GROUP)) {
      expect(validGroups.has(group), `${key} maps to invalid group "${group}"`).toBe(true);
    }
  });
});
