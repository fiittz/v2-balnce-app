import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDoc, mockAutoTable } = vi.hoisted(() => {
  const mockDoc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    setFillColor: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    addPage: vi.fn(),
    setPage: vi.fn(),
    save: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    internal: { pageSize: { getWidth: () => 210 } },
    lastAutoTable: { finalY: 100 },
    splitTextToSize: vi.fn((text: string) => [text]),
  };
  const mockAutoTable = vi.fn();
  return { mockDoc, mockAutoTable };
});

vi.mock("jspdf", () => ({
  default: function JsPDFMock() {
    return mockDoc;
  },
}));

vi.mock("jspdf-autotable", () => ({
  default: mockAutoTable,
}));

import {
  createPdfDoc,
  addHeader,
  addSection,
  addTable,
  addFooter,
  addSignatures,
  savePdf,
} from "@/lib/reports/pdfHelpers";
import type { ReportMeta, ReportSection, ReportTable } from "@/lib/reports/types";

// ── Test Data ─────────────────────────────────────────────────
function makeMeta(overrides: Partial<ReportMeta> = {}): ReportMeta {
  return {
    companyName: "Test Company Ltd",
    taxYear: "2024",
    generatedDate: new Date("2024-12-31"),
    preparer: "Balnce",
    registeredAddress: "123 Main St, Dublin",
    directorNames: [],
    ...overrides,
  };
}

function makeSection(overrides: Partial<ReportSection> = {}): ReportSection {
  return {
    title: "Test Section",
    rows: [
      { label: "Revenue", value: "100,000" },
      { label: "Expenses", value: "50,000" },
    ],
    ...overrides,
  };
}

function makeTable(overrides: Partial<ReportTable> = {}): ReportTable {
  return {
    title: "Test Table",
    headers: ["Category", "Amount"],
    rows: [
      ["Materials", "30,000"],
      ["Fuel", "5,000"],
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.getNumberOfPages.mockReturnValue(1);
});

// ================================================================
// createPdfDoc
// ================================================================
describe("createPdfDoc", () => {
  it("returns a jsPDF instance", () => {
    const doc = createPdfDoc();
    expect(doc).toBeDefined();
  });
});

// ================================================================
// addHeader
// ================================================================
describe("addHeader", () => {
  it("renders company name as header text", () => {
    const doc = createPdfDoc();
    const meta = makeMeta();
    addHeader(doc, meta, "CT1 Report");
    expect(mockDoc.text).toHaveBeenCalledWith("Test Company Ltd", 20, 25);
  });

  it("renders report title", () => {
    const doc = createPdfDoc();
    const meta = makeMeta();
    addHeader(doc, meta, "CT1 Report");
    expect(mockDoc.text).toHaveBeenCalledWith("CT1 Report", 20, expect.any(Number));
  });

  it("renders registered address when present", () => {
    const doc = createPdfDoc();
    const meta = makeMeta({ registeredAddress: "456 Test Rd" });
    addHeader(doc, meta, "Report");
    expect(mockDoc.text).toHaveBeenCalledWith("456 Test Rd", 20, expect.any(Number), { maxWidth: 170 });
  });

  it("skips registered address when absent", () => {
    const doc = createPdfDoc();
    const meta = makeMeta({ registeredAddress: undefined });
    addHeader(doc, meta, "Report");
    // Should not have address call with maxWidth option at y=33
    const addressCalls = mockDoc.text.mock.calls.filter((call: unknown[]) => call[0] === undefined);
    expect(addressCalls.length).toBe(0);
  });

  it("renders preparer when present", () => {
    const doc = createPdfDoc();
    const meta = makeMeta({ preparer: "John CPA" });
    addHeader(doc, meta, "Report");
    expect(mockDoc.text).toHaveBeenCalledWith("Prepared by: John CPA", 20, expect.any(Number));
  });

  it("returns a y-coordinate for next content", () => {
    const doc = createPdfDoc();
    const meta = makeMeta();
    const y = addHeader(doc, meta, "Report");
    expect(typeof y).toBe("number");
    expect(y).toBeGreaterThan(0);
  });
});

// ================================================================
// addSection
// ================================================================
describe("addSection", () => {
  it("renders section title", () => {
    const doc = createPdfDoc();
    const section = makeSection();
    addSection(doc, section, 80);
    expect(mockDoc.text).toHaveBeenCalledWith("Test Section", 20, 80);
  });

  it("renders each row label and value", () => {
    const doc = createPdfDoc();
    const section = makeSection();
    addSection(doc, section, 80);
    expect(mockDoc.text).toHaveBeenCalledWith("Revenue", 22, expect.any(Number));
    expect(mockDoc.text).toHaveBeenCalledWith("100,000", 188, expect.any(Number), { align: "right" });
  });

  it("adds new page when y exceeds 260", () => {
    const doc = createPdfDoc();
    const section = makeSection();
    addSection(doc, section, 265);
    expect(mockDoc.addPage).toHaveBeenCalled();
  });

  it("adds new page inside row loop when y exceeds 275", () => {
    const doc = createPdfDoc();
    // Create a section with many rows so that y surpasses 275 during iteration
    const manyRows = Array.from({ length: 50 }, (_, i) => ({
      label: `Row ${i}`,
      value: `${i * 100}`,
    }));
    const section = makeSection({ rows: manyRows });
    // Start at y=100. Each row adds 6, so after ~30 rows y = 100 + 7 (title) + 30*6 = 287 > 275
    addSection(doc, section, 100);
    // addPage should be called once (for exceeding 275 inside the loop)
    expect(mockDoc.addPage).toHaveBeenCalled();
  });

  it("applies alternating row fill on even indices", () => {
    const doc = createPdfDoc();
    const section = makeSection();
    addSection(doc, section, 80);
    expect(mockDoc.setFillColor).toHaveBeenCalledWith(248, 248, 248);
    expect(mockDoc.rect).toHaveBeenCalled();
  });
});

// ================================================================
// addTable
// ================================================================
describe("addTable", () => {
  it("renders table title", () => {
    const doc = createPdfDoc();
    const table = makeTable();
    addTable(doc, table, 80);
    expect(mockDoc.text).toHaveBeenCalledWith("Test Table", 20, 80);
  });

  it("calls autoTable with headers and body", () => {
    const doc = createPdfDoc();
    const table = makeTable();
    addTable(doc, table, 80);
    expect(mockAutoTable).toHaveBeenCalledWith(
      doc,
      expect.objectContaining({
        head: [["Category", "Amount"]],
        body: [
          ["Materials", "30,000"],
          ["Fuel", "5,000"],
        ],
      }),
    );
  });

  it("adds new page when startY exceeds 250", () => {
    const doc = createPdfDoc();
    const table = makeTable();
    addTable(doc, table, 255);
    expect(mockDoc.addPage).toHaveBeenCalled();
  });

  it("returns finalY + 8 from lastAutoTable", () => {
    const doc = createPdfDoc();
    const table = makeTable();
    const result = addTable(doc, table, 80);
    // lastAutoTable.finalY is 100, so result = 108
    expect(result).toBe(108);
  });
});

// ================================================================
// addFooter
// ================================================================
describe("addFooter", () => {
  it("sets page for each page number", () => {
    mockDoc.getNumberOfPages.mockReturnValue(3);
    const doc = createPdfDoc();
    addFooter(doc);
    expect(mockDoc.setPage).toHaveBeenCalledWith(1);
    expect(mockDoc.setPage).toHaveBeenCalledWith(2);
    expect(mockDoc.setPage).toHaveBeenCalledWith(3);
    expect(mockDoc.setPage).toHaveBeenCalledTimes(3);
  });

  it("renders page numbers and disclaimer on each page", () => {
    mockDoc.getNumberOfPages.mockReturnValue(1);
    const doc = createPdfDoc();
    addFooter(doc);
    expect(mockDoc.text).toHaveBeenCalledWith("Page 1 of 1", 190, 290, { align: "right" });
    expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining("AI-generated"), 20, 290);
  });
});

// ================================================================
// addSignatures
// ================================================================
describe("addSignatures", () => {
  it("returns startY unchanged when no directors", () => {
    const doc = createPdfDoc();
    const meta = makeMeta({ directorNames: [] });
    const result = addSignatures(doc, meta, 200);
    expect(result).toBe(200);
  });

  it("renders director + secretary lines for single director", () => {
    const doc = createPdfDoc();
    const meta = makeMeta({ directorNames: ["Alice Murphy"] });
    addSignatures(doc, meta, 100);
    expect(mockDoc.text).toHaveBeenCalledWith("Director", 20, expect.any(Number));
    expect(mockDoc.text).toHaveBeenCalledWith("Secretary", expect.any(Number), expect.any(Number));
    expect(mockDoc.text).toHaveBeenCalledWith("Alice Murphy", 20, expect.any(Number));
  });

  it("renders director lines for multiple directors (no secretary)", () => {
    const doc = createPdfDoc();
    const meta = makeMeta({ directorNames: ["Alice Murphy", "Bob Smith"] });
    addSignatures(doc, meta, 100);
    const directorCalls = mockDoc.text.mock.calls.filter((call: unknown[]) => call[0] === "Director");
    expect(directorCalls.length).toBe(2);
    // Secretary should NOT be rendered
    const secretaryCalls = mockDoc.text.mock.calls.filter((call: unknown[]) => call[0] === "Secretary");
    expect(secretaryCalls.length).toBe(0);
  });

  it("adds new page if not enough space", () => {
    const doc = createPdfDoc();
    const meta = makeMeta({ directorNames: ["Alice"] });
    addSignatures(doc, meta, 275);
    expect(mockDoc.addPage).toHaveBeenCalled();
  });
});

// ================================================================
// savePdf
// ================================================================
describe("savePdf", () => {
  it("calls doc.save with the given filename", () => {
    const doc = createPdfDoc();
    savePdf(doc, "test_report.pdf");
    expect(mockDoc.save).toHaveBeenCalledWith("test_report.pdf");
  });
});
