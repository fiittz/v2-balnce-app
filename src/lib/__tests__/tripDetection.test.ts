import { describe, it, expect } from "vitest";
import {
  extractBaseLocation,
  extractCountyFromAddress,
  detectTransactionLocation,
  classifyTripExpense,
  detectTrips,
  type DetectTripsInput,
} from "../tripDetection";

// ══════════════════════════════════════════════════════════════
// extractBaseLocation
// ══════════════════════════════════════════════════════════════
describe("extractBaseLocation", () => {
  it("extracts Dublin from address string", () => {
    expect(extractBaseLocation("12 Main St, Dublin 4")).toBe("Dublin");
  });

  it("extracts Cork from address string", () => {
    expect(extractBaseLocation("Unit 5, Douglas Rd, Cork")).toBe("Cork");
  });

  it("handles abbreviations (dub → Dublin)", () => {
    expect(extractBaseLocation("Somewhere DUB area")).toBe("Dublin");
  });

  it("returns null for unknown address", () => {
    expect(extractBaseLocation("123 Random Place, Nowhere")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(extractBaseLocation(null)).toBeNull();
    expect(extractBaseLocation(undefined)).toBeNull();
    expect(extractBaseLocation("")).toBeNull();
  });

  it("returns Dublin for Dublin Eircode D15", () => {
    expect(extractBaseLocation("12 Road, D15 XYZ")).toBe("Dublin");
  });

  it("returns Dublin for Dublin Eircode D01", () => {
    expect(extractBaseLocation("Apt 4, D01 AB12")).toBe("Dublin");
  });

  it("returns Dublin for Dublin Eircode D24", () => {
    expect(extractBaseLocation("Unit 3, D24 FG78")).toBe("Dublin");
  });

  it("returns Dublin for Dublin Eircode D6W", () => {
    expect(extractBaseLocation("10 Street, D6W HJ90")).toBe("Dublin");
  });

  it("does not match non-Dublin Eircodes (e.g. T12)", () => {
    expect(extractBaseLocation("45 Lane, T12 AB34")).toBeNull();
  });

  it("returns Tyrrelstown for an address with only Tyrrelstown (no Dublin)", () => {
    expect(extractBaseLocation("5 Avenue, Tyrrelstown")).toBe("Tyrrelstown");
  });

  describe("fallback address", () => {
    it("uses fallback when primary is null", () => {
      expect(extractBaseLocation(null, "Tyrrelstown")).toBe("Tyrrelstown");
    });

    it("uses fallback when primary has no match", () => {
      expect(extractBaseLocation("123 Unknown Place", "Blanchardstown")).toBe("Blanchardstown");
    });

    it("prefers primary over fallback", () => {
      expect(extractBaseLocation("10 Cork Road, Cork", "Blanchardstown")).toBe("Cork");
    });

    it("returns null when both are null", () => {
      expect(extractBaseLocation(null, null)).toBeNull();
    });
  });

  it("is case-insensitive", () => {
    expect(extractBaseLocation("GALWAY CITY")).toBe("Galway");
  });
});

// ══════════════════════════════════════════════════════════════
// extractCountyFromAddress
// ══════════════════════════════════════════════════════════════
describe("extractCountyFromAddress", () => {
  it("extracts county from 'Co. Kerry' pattern", () => {
    expect(extractCountyFromAddress("Tralee, Co. Kerry")).toBe("Kerry");
  });

  it("extracts county from 'County Cork' pattern", () => {
    expect(extractCountyFromAddress("Main St, County Cork")).toBe("Cork");
  });

  it("extracts county from town lookup (Killarney → Kerry)", () => {
    expect(extractCountyFromAddress("Market Lane, Killarney")).toBe("Kerry");
  });

  it("extracts county from town lookup (Navan → Meath)", () => {
    expect(extractCountyFromAddress("Railway St, Navan")).toBe("Meath");
  });

  it("returns null for unrecognised address", () => {
    expect(extractCountyFromAddress("Unknown Place 123")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractCountyFromAddress("")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// detectTransactionLocation
// ══════════════════════════════════════════════════════════════
describe("detectTransactionLocation", () => {
  it("detects Dublin in transaction description", () => {
    expect(detectTransactionLocation("POS TESCO DUBLIN")).toBe("Dublin");
  });

  it("detects Cork in transaction description", () => {
    expect(detectTransactionLocation("CARD PAYMENT SPAR CORK")).toBe("Cork");
  });

  it("prefers longer match (carrickmacross over carrick)", () => {
    expect(detectTransactionLocation("POS CENTRA CARRICKMACROSS")).toBe("Carrickmacross");
  });

  it("returns null when no location found", () => {
    expect(detectTransactionLocation("DIRECT DEBIT NETFLIX")).toBeNull();
  });

  it("detects port of location", () => {
    expect(detectTransactionLocation("PORT OF CORK FEE")).toBe("Cork");
  });
});

// ══════════════════════════════════════════════════════════════
// classifyTripExpense
// ══════════════════════════════════════════════════════════════
describe("classifyTripExpense", () => {
  it("classifies hotel as accommodation", () => {
    expect(classifyTripExpense("Maldron Hotel Cork")).toBe("accommodation");
  });

  it("classifies Airbnb as accommodation", () => {
    expect(classifyTripExpense("AIRBNB BOOKING")).toBe("accommodation");
  });

  it("classifies B&B as accommodation", () => {
    expect(classifyTripExpense("O'Connor's B&B")).toBe("accommodation");
  });

  it("classifies booking.com as accommodation", () => {
    expect(classifyTripExpense("BOOKING.COM RESERVATION")).toBe("accommodation");
  });

  it("classifies lodge as accommodation", () => {
    expect(classifyTripExpense("THE LODGE KILLARNEY")).toBe("accommodation");
  });

  it("classifies toll as transport", () => {
    expect(classifyTripExpense("EFLOW TOLL M50")).toBe("transport");
  });

  it("classifies taxi as transport", () => {
    expect(classifyTripExpense("FREENOW TAXI")).toBe("transport");
  });

  it("classifies fuel as transport", () => {
    expect(classifyTripExpense("CIRCLE K FUEL")).toBe("transport");
  });

  it("classifies restaurant as subsistence", () => {
    expect(classifyTripExpense("NANDOS RESTAURANT")).toBe("subsistence");
  });

  it("classifies cafe as subsistence", () => {
    expect(classifyTripExpense("COSTA COFFEE DUBLIN")).toBe("subsistence");
  });

  it("returns other for unclassifiable descriptions", () => {
    expect(classifyTripExpense("RANDOM PURCHASE XYZ")).toBe("other");
  });
});

// ══════════════════════════════════════════════════════════════
// detectTrips
// ══════════════════════════════════════════════════════════════
describe("detectTrips", () => {
  const makeExpense = (id: string, desc: string, date: string, amount: number): DetectTripsInput => ({
    id,
    description: desc,
    amount,
    date,
    type: "expense",
  });

  it("returns empty for no transactions", () => {
    expect(detectTrips([], "Dublin")).toEqual([]);
  });

  it("returns empty when all transactions are income", () => {
    const txns: DetectTripsInput[] = [
      { id: "1", description: "POS CORK", amount: 100, date: "2024-03-15", type: "income" },
    ];
    expect(detectTrips(txns, "Dublin")).toEqual([]);
  });

  it("detects a trip with 2+ expenses at same location/date", () => {
    const txns = [
      makeExpense("1", "POS CENTRA CORK", "2024-03-15", 10),
      makeExpense("2", "POS SPAR CORK", "2024-03-15", 15),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(1);
    expect(trips[0].location).toBe("Cork");
    expect(trips[0].transactions).toHaveLength(2);
    expect(trips[0].totalSpend).toBe(25);
  });

  it("detects a trip with a single hotel booking", () => {
    const txns = [makeExpense("1", "MALDRON HOTEL GALWAY", "2024-03-15", 120)];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(1);
    expect(trips[0].location).toBe("Galway");
  });

  it("skips transactions at base location", () => {
    const txns = [
      makeExpense("1", "POS CENTRA DUBLIN", "2024-03-15", 10),
      makeExpense("2", "POS SPAR DUBLIN", "2024-03-15", 15),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(0);
  });

  it("merges consecutive days at the same location", () => {
    const txns = [
      makeExpense("1", "POS CENTRA CORK", "2024-03-15", 10),
      makeExpense("2", "POS SPAR CORK", "2024-03-15", 15),
      makeExpense("3", "POS TESCO CORK", "2024-03-16", 20),
      makeExpense("4", "POS MAXOL CORK", "2024-03-16", 30),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(1);
    expect(trips[0].startDate).toBe("2024-03-15");
    expect(trips[0].endDate).toBe("2024-03-16");
    expect(trips[0].transactions).toHaveLength(4);
    expect(trips[0].totalSpend).toBe(75);
  });

  it("does not merge non-consecutive days", () => {
    const txns = [
      makeExpense("1", "POS CENTRA CORK", "2024-03-15", 10),
      makeExpense("2", "POS SPAR CORK", "2024-03-15", 15),
      makeExpense("3", "POS CENTRA CORK", "2024-03-18", 20),
      makeExpense("4", "POS SPAR CORK", "2024-03-18", 30),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(2);
  });

  it("does not qualify a single non-hotel expense", () => {
    const txns = [makeExpense("1", "POS CENTRA CORK", "2024-03-15", 10)];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(0);
  });

  it("handles null base location (no location filtering)", () => {
    const txns = [
      makeExpense("1", "POS CENTRA CORK", "2024-03-15", 10),
      makeExpense("2", "POS SPAR CORK", "2024-03-15", 15),
    ];
    const trips = detectTrips(txns, null);
    expect(trips).toHaveLength(1);
  });

  it("classifies expense types within trip transactions", () => {
    const txns = [
      makeExpense("1", "MALDRON HOTEL GALWAY", "2024-03-15", 150),
      makeExpense("2", "POS RESTAURANT GALWAY", "2024-03-15", 35),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips[0].transactions.find((t) => t.id === "1")?.expenseType).toBe("accommodation");
    expect(trips[0].transactions.find((t) => t.id === "2")?.expenseType).toBe("subsistence");
  });
});

// ══════════════════════════════════════════════════════════════
// detectTransactionLocation — port/ferry/airport pattern branch
// ══════════════════════════════════════════════════════════════
describe("detectTransactionLocation — port match fallback", () => {
  it("returns null when port-of location is not in IRISH_LOCATIONS", () => {
    expect(detectTransactionLocation("PORT OF TIMBUKTU FEE")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// detectTrips — sorting by location, then date (line 294)
// ══════════════════════════════════════════════════════════════
describe("detectTrips — multi-location sorting and final trip push", () => {
  const makeExpense = (id: string, desc: string, date: string, amount: number): DetectTripsInput => ({
    id,
    description: desc,
    amount,
    date,
    type: "expense",
  });

  it("sorts qualified days by location then date, producing separate trips (line 294)", () => {
    // Two different locations on the same day — triggers locCmp !== 0 sort branch
    const txns = [
      makeExpense("1", "POS CENTRA GALWAY", "2024-03-15", 10),
      makeExpense("2", "POS SPAR GALWAY", "2024-03-15", 15),
      makeExpense("3", "POS CENTRA CORK", "2024-03-15", 10),
      makeExpense("4", "POS SPAR CORK", "2024-03-15", 15),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(2);
    // Should be sorted by location alphabetically: Cork before Galway
    expect(trips[0].location).toBe("Cork");
    expect(trips[1].location).toBe("Galway");
  });

  it("pushes the final current trip at end of loop (line 330)", () => {
    // Single day-group that qualifies — ensures the final `if (current)` push is hit
    const txns = [
      makeExpense("1", "POS CENTRA CORK", "2024-05-01", 10),
      makeExpense("2", "POS SPAR CORK", "2024-05-01", 15),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(1);
    expect(trips[0].location).toBe("Cork");
  });

  it("skips transactions matching base location case-insensitively (line 267)", () => {
    const txns = [
      makeExpense("1", "POS CENTRA DUBLIN", "2024-03-15", 10),
      makeExpense("2", "POS SPAR DUBLIN", "2024-03-15", 15),
    ];
    // Base location passed with different case
    const trips = detectTrips(txns, "DUBLIN");
    expect(trips).toHaveLength(0);
  });

  it("skips Dublin transactions when base is Blanchardstown (same county)", () => {
    const txns = [
      makeExpense("1", "LIDL DUBLIN", "2024-03-15", 10),
      makeExpense("2", "CENTRA DUBLIN", "2024-03-15", 15),
      makeExpense("3", "COSTA DUBLIN", "2024-03-15", 8),
    ];
    const trips = detectTrips(txns, "Blanchardstown");
    expect(trips).toHaveLength(0);
  });

  it("skips Swords transactions when base is Dublin (same county)", () => {
    const txns = [
      makeExpense("1", "LIDL SWORDS", "2024-03-15", 10),
      makeExpense("2", "CENTRA SWORDS", "2024-03-15", 15),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(0);
  });

  it("detects Cork trip when base is Blanchardstown (different county)", () => {
    const txns = [
      makeExpense("1", "LIDL CORK", "2024-03-15", 10),
      makeExpense("2", "CENTRA CORK", "2024-03-15", 15),
    ];
    const trips = detectTrips(txns, "Blanchardstown");
    expect(trips).toHaveLength(1);
    expect(trips[0].location).toBe("Cork");
  });
});

// ══════════════════════════════════════════════════════════════
// detectTransactionLocation — port match where loc is in IRISH_LOCATIONS (line 212)
// ══════════════════════════════════════════════════════════════
describe("detectTransactionLocation — port match found in IRISH_LOCATIONS", () => {
  it("returns the canonical location when port-of location is in IRISH_LOCATIONS", () => {
    // "port of cork" — "cork" is in IRISH_LOCATIONS
    // This actually matches "cork" via the main loop first, but let's ensure it works
    expect(detectTransactionLocation("PORT OF CORK FERRY")).toBe("Cork");
  });
});

// ══════════════════════════════════════════════════════════════
// classifyTripExpense — excluded keywords
// ══════════════════════════════════════════════════════════════
describe("classifyTripExpense — excluded keywords", () => {
  it("classifies bank charge as other (excluded)", () => {
    expect(classifyTripExpense("BANK CHARGE Q1")).toBe("other");
  });

  it("classifies revenue payment as other (excluded)", () => {
    expect(classifyTripExpense("REV COMM PAYMENT")).toBe("other");
  });

  it("classifies ferry as transport", () => {
    expect(classifyTripExpense("STENA LINE FERRY")).toBe("transport");
  });

  it("classifies bus as transport", () => {
    expect(classifyTripExpense("BUS EIREANN TICKET")).toBe("transport");
  });
});

// ══════════════════════════════════════════════════════════════
// extractCountyFromAddress — regex match with invalid county
// ══════════════════════════════════════════════════════════════
describe("extractCountyFromAddress — county regex falsy branch", () => {
  it("returns null when regex matches but county is not valid", () => {
    // "Co. Wonderland" — regex matches, candidate = "Wonderland", but not a real Irish county
    expect(extractCountyFromAddress("123 Main St, Co. Wonderland")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// detectTrips — no-location transactions skipped
// ══════════════════════════════════════════════════════════════
describe("detectTrips — no-location skip", () => {
  const makeExpense = (id: string, desc: string, date: string, amount: number): DetectTripsInput => ({
    id,
    description: desc,
    amount,
    date,
    type: "expense",
  });

  it("skips transactions with no detectable location", () => {
    const txns = [
      // No location — should be skipped
      makeExpense("1", "DIRECT DEBIT NETFLIX", "2024-03-15", 15),
      makeExpense("2", "STRIPE PAYMENT XYZ", "2024-03-15", 30),
      // With location — qualifies (2 at same location)
      makeExpense("3", "POS CENTRA CORK", "2024-03-15", 10),
      makeExpense("4", "POS SPAR CORK", "2024-03-15", 15),
    ];
    const trips = detectTrips(txns, "Dublin");
    expect(trips).toHaveLength(1);
    expect(trips[0].location).toBe("Cork");
    expect(trips[0].transactions).toHaveLength(2);
  });
});
