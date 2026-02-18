import { describe, it, expect } from "vitest";
import { IRISH_TOWNS, formatTownDisplay, IrishTown } from "../irishTowns";

// All 26 counties of the Republic of Ireland
const ALL_26_COUNTIES = [
  "Carlow",
  "Cavan",
  "Clare",
  "Cork",
  "Donegal",
  "Dublin",
  "Galway",
  "Kerry",
  "Kildare",
  "Kilkenny",
  "Laois",
  "Leitrim",
  "Limerick",
  "Longford",
  "Louth",
  "Mayo",
  "Meath",
  "Monaghan",
  "Offaly",
  "Roscommon",
  "Sligo",
  "Tipperary",
  "Waterford",
  "Westmeath",
  "Wexford",
  "Wicklow",
];

// ══════════════════════════════════════════════════════════════
// IRISH_TOWNS array — structure and completeness
// ══════════════════════════════════════════════════════════════
describe("IRISH_TOWNS array", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(IRISH_TOWNS)).toBe(true);
    expect(IRISH_TOWNS.length).toBeGreaterThan(0);
  });

  it("contains a substantial number of towns", () => {
    // The dataset has entries across all 26 counties; expect well over 100
    expect(IRISH_TOWNS.length).toBeGreaterThanOrEqual(100);
  });

  it("each town has name, county, and distanceFromDublin properties", () => {
    for (const town of IRISH_TOWNS) {
      expect(town).toHaveProperty("name");
      expect(town).toHaveProperty("county");
      expect(town).toHaveProperty("distanceFromDublin");
    }
  });

  it("each town has correct property types", () => {
    for (const town of IRISH_TOWNS) {
      expect(typeof town.name).toBe("string");
      expect(typeof town.county).toBe("string");
      expect(typeof town.distanceFromDublin).toBe("number");
    }
  });
});

// ══════════════════════════════════════════════════════════════
// County coverage — all 26 counties represented
// ══════════════════════════════════════════════════════════════
describe("county coverage", () => {
  const countiesInData = new Set(IRISH_TOWNS.map((t) => t.county));

  it("represents all 26 Republic of Ireland counties", () => {
    for (const county of ALL_26_COUNTIES) {
      expect(countiesInData.has(county)).toBe(true);
    }
  });

  it("has exactly 26 distinct counties (no extras or typos)", () => {
    expect(countiesInData.size).toBe(26);
  });

  it("every county in the data is a valid Irish county", () => {
    for (const county of countiesInData) {
      expect(ALL_26_COUNTIES).toContain(county);
    }
  });

  it("each county has at least 3 towns", () => {
    for (const county of ALL_26_COUNTIES) {
      const townsInCounty = IRISH_TOWNS.filter((t) => t.county === county);
      expect(townsInCounty.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Dublin towns — distance range 0-35 km
// ══════════════════════════════════════════════════════════════
describe("Dublin towns", () => {
  const dublinTowns = IRISH_TOWNS.filter((t) => t.county === "Dublin");

  it("has multiple entries for Dublin county", () => {
    expect(dublinTowns.length).toBeGreaterThanOrEqual(10);
  });

  it("includes Dublin city itself with distance 0", () => {
    const dublinCity = dublinTowns.find((t) => t.name === "Dublin");
    expect(dublinCity).toBeDefined();
    expect(dublinCity!.distanceFromDublin).toBe(0);
  });

  it("all Dublin towns have distances in the 0-35 km range", () => {
    for (const town of dublinTowns) {
      expect(town.distanceFromDublin).toBeGreaterThanOrEqual(0);
      expect(town.distanceFromDublin).toBeLessThanOrEqual(35);
    }
  });

  it("includes well-known Dublin suburbs", () => {
    const names = dublinTowns.map((t) => t.name);
    expect(names).toContain("Swords");
    expect(names).toContain("Tallaght");
    expect(names).toContain("Dun Laoghaire");
    expect(names).toContain("Malahide");
  });
});

// ══════════════════════════════════════════════════════════════
// Cork towns — realistic distances (~200-350 km from Dublin)
// ══════════════════════════════════════════════════════════════
describe("Cork towns", () => {
  const corkTowns = IRISH_TOWNS.filter((t) => t.county === "Cork");

  it("has multiple entries for Cork county", () => {
    expect(corkTowns.length).toBeGreaterThanOrEqual(10);
  });

  it("all Cork towns have distances in the realistic ~200-350 km range", () => {
    for (const town of corkTowns) {
      expect(town.distanceFromDublin).toBeGreaterThanOrEqual(200);
      expect(town.distanceFromDublin).toBeLessThanOrEqual(350);
    }
  });

  it("includes Cork city with distance ~260 km", () => {
    const corkCity = corkTowns.find((t) => t.name === "Cork");
    expect(corkCity).toBeDefined();
    expect(corkCity!.distanceFromDublin).toBe(260);
  });

  it("includes well-known Cork towns", () => {
    const names = corkTowns.map((t) => t.name);
    expect(names).toContain("Cobh");
    expect(names).toContain("Kinsale");
    expect(names).toContain("Bantry");
    expect(names).toContain("Mallow");
  });
});

// ══════════════════════════════════════════════════════════════
// formatTownDisplay — "Town, Co. County" format
// ══════════════════════════════════════════════════════════════
describe("formatTownDisplay", () => {
  it('returns "Town, Co. County" format', () => {
    const town: IrishTown = {
      name: "Galway",
      county: "Galway",
      distanceFromDublin: 210,
    };
    expect(formatTownDisplay(town)).toBe("Galway, Co. Galway");
  });

  it("formats Dublin correctly", () => {
    const town: IrishTown = {
      name: "Dublin",
      county: "Dublin",
      distanceFromDublin: 0,
    };
    expect(formatTownDisplay(town)).toBe("Dublin, Co. Dublin");
  });

  it("handles multi-word town names", () => {
    const town: IrishTown = {
      name: "Dun Laoghaire",
      county: "Dublin",
      distanceFromDublin: 12,
    };
    expect(formatTownDisplay(town)).toBe("Dun Laoghaire, Co. Dublin");
  });

  it("handles hyphenated town names", () => {
    const town: IrishTown = {
      name: "Carrick-on-Shannon",
      county: "Leitrim",
      distanceFromDublin: 160,
    };
    expect(formatTownDisplay(town)).toBe("Carrick-on-Shannon, Co. Leitrim");
  });

  it("handles multi-word county names (no multi-word counties in data, but verifies format)", () => {
    const town: IrishTown = {
      name: "Newcastle West",
      county: "Limerick",
      distanceFromDublin: 235,
    };
    expect(formatTownDisplay(town)).toBe("Newcastle West, Co. Limerick");
  });

  it("formats every town in IRISH_TOWNS without throwing", () => {
    for (const town of IRISH_TOWNS) {
      const result = formatTownDisplay(town);
      expect(result).toContain(town.name);
      expect(result).toContain(`Co. ${town.county}`);
      expect(result).toMatch(/^.+, Co\. .+$/);
    }
  });

  it("formats Cahersiveen, Co. Kerry correctly", () => {
    const town: IrishTown = {
      name: "Cahersiveen",
      county: "Kerry",
      distanceFromDublin: 355,
    };
    expect(formatTownDisplay(town)).toBe("Cahersiveen, Co. Kerry");
  });
});

// ══════════════════════════════════════════════════════════════
// No duplicate town entries (same name + same county)
// ══════════════════════════════════════════════════════════════
describe("no duplicate entries", () => {
  it("has no duplicate town entries with the same name and county", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const town of IRISH_TOWNS) {
      const key = `${town.name}|${town.county}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }

    expect(duplicates).toEqual([]);
  });

  it("the set of unique keys matches the array length", () => {
    const keys = IRISH_TOWNS.map((t) => `${t.name}|${t.county}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(IRISH_TOWNS.length);
  });
});

// ══════════════════════════════════════════════════════════════
// All distances are non-negative numbers
// ══════════════════════════════════════════════════════════════
describe("distance values", () => {
  it("all distances are non-negative numbers", () => {
    for (const town of IRISH_TOWNS) {
      expect(town.distanceFromDublin).toBeGreaterThanOrEqual(0);
    }
  });

  it("no distances are NaN", () => {
    for (const town of IRISH_TOWNS) {
      expect(Number.isNaN(town.distanceFromDublin)).toBe(false);
    }
  });

  it("no distances are Infinity", () => {
    for (const town of IRISH_TOWNS) {
      expect(Number.isFinite(town.distanceFromDublin)).toBe(true);
    }
  });

  it("all distances are whole numbers (integers)", () => {
    for (const town of IRISH_TOWNS) {
      expect(Number.isInteger(town.distanceFromDublin)).toBe(true);
    }
  });

  it("only Dublin city has distance 0", () => {
    const zeroDistanceTowns = IRISH_TOWNS.filter((t) => t.distanceFromDublin === 0);
    expect(zeroDistanceTowns).toHaveLength(1);
    expect(zeroDistanceTowns[0].name).toBe("Dublin");
    expect(zeroDistanceTowns[0].county).toBe("Dublin");
  });

  it("maximum distance does not exceed 400 km (Ireland is ~486 km long)", () => {
    const maxDistance = Math.max(...IRISH_TOWNS.map((t) => t.distanceFromDublin));
    expect(maxDistance).toBeLessThanOrEqual(400);
  });
});

// ══════════════════════════════════════════════════════════════
// All names are non-empty strings
// ══════════════════════════════════════════════════════════════
describe("name and county strings", () => {
  it("all town names are non-empty strings", () => {
    for (const town of IRISH_TOWNS) {
      expect(town.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("all county names are non-empty strings", () => {
    for (const town of IRISH_TOWNS) {
      expect(town.county.trim().length).toBeGreaterThan(0);
    }
  });

  it("no town names have leading or trailing whitespace", () => {
    for (const town of IRISH_TOWNS) {
      expect(town.name).toBe(town.name.trim());
    }
  });

  it("no county names have leading or trailing whitespace", () => {
    for (const town of IRISH_TOWNS) {
      expect(town.county).toBe(town.county.trim());
    }
  });
});
