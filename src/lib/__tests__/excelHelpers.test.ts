import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock variables are available inside vi.mock factories
const { mockCell, mockRow, mockColumn, mockWorksheet, mockWorkbook, mockSaveAs } = vi.hoisted(() => {
  const mockCell = { border: null, alignment: null, value: "test" };
  const mockRow = {
    font: null as unknown,
    height: null as unknown,
    fill: null as unknown,
    getCell: vi.fn(() => mockCell),
    eachCell: vi.fn(),
  };
  const mockColumn = {
    width: 12,
    eachCell: vi.fn(),
  };
  const mockWorksheet = {
    addRow: vi.fn(() => mockRow),
    rowCount: 5,
    columns: [mockColumn],
    getColumn: vi.fn(() => mockColumn),
  };
  const mockWorkbook = {
    creator: "",
    created: null as unknown,
    company: "",
    addWorksheet: vi.fn(() => mockWorksheet),
    xlsx: { writeBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(8))) },
  };
  const mockSaveAs = vi.fn();
  return { mockCell, mockRow, mockColumn, mockWorksheet, mockWorkbook, mockSaveAs };
});

vi.mock("exceljs", () => ({
  default: {
    Workbook: function WorkbookMock() {
      return mockWorkbook;
    },
  },
}));

vi.mock("file-saver", () => ({
  saveAs: mockSaveAs,
}));

import {
  createWorkbook,
  addHeaderRows,
  addSectionRows,
  addTableRows,
  styleSheet,
  saveWorkbook,
} from "@/lib/reports/excelHelpers";
import type { ReportMeta, ReportSection, ReportTable } from "@/lib/reports/types";

// ── Test Data ─────────────────────────────────────────────────
function makeMeta(overrides: Partial<ReportMeta> = {}): ReportMeta {
  return {
    companyName: "Test Company Ltd",
    taxYear: "2024",
    generatedDate: new Date("2024-12-31"),
    preparer: "Balnce",
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
  mockWorkbook.creator = "";
  mockWorkbook.created = null;
  mockWorkbook.company = "";
  mockRow.font = null;
  mockRow.height = null;
  mockRow.fill = null;
  mockWorksheet.rowCount = 5;
});

// ================================================================
// createWorkbook
// ================================================================
describe("createWorkbook", () => {
  it("sets creator from meta.preparer", () => {
    const wb = createWorkbook(makeMeta({ preparer: "John CPA" }));
    expect(wb.creator).toBe("John CPA");
  });

  it("defaults creator to 'Balnce' when no preparer", () => {
    const wb = createWorkbook(makeMeta({ preparer: undefined }));
    expect(wb.creator).toBe("Balnce");
  });

  it("sets company from meta.companyName", () => {
    const wb = createWorkbook(makeMeta({ companyName: "Acme Ltd" }));
    expect(wb.company).toBe("Acme Ltd");
  });

  it("sets created date from meta.generatedDate", () => {
    const date = new Date("2024-06-15");
    const wb = createWorkbook(makeMeta({ generatedDate: date }));
    expect(wb.created).toBe(date);
  });
});

// ================================================================
// addHeaderRows
// ================================================================
describe("addHeaderRows", () => {
  it("adds company name as first row", () => {
    const meta = makeMeta();
    addHeaderRows(mockWorksheet as never, meta, "CT1 Report");
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Test Company Ltd"]);
  });

  it("adds report title as subtitle row", () => {
    const meta = makeMeta();
    addHeaderRows(mockWorksheet as never, meta, "CT1 Report");
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["CT1 Report"]);
  });

  it("adds tax year row", () => {
    const meta = makeMeta({ taxYear: "2024" });
    addHeaderRows(mockWorksheet as never, meta, "Report");
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Year ended 31 December 2024"]);
  });

  it("adds preparer row when preparer is present", () => {
    const meta = makeMeta({ preparer: "Jane" });
    addHeaderRows(mockWorksheet as never, meta, "Report");
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Prepared by: Jane"]);
  });

  it("skips preparer row when not present", () => {
    const meta = makeMeta({ preparer: undefined });
    addHeaderRows(mockWorksheet as never, meta, "Report");
    const preparerCalls = mockWorksheet.addRow.mock.calls.filter(
      (call: unknown[][]) => typeof call[0]?.[0] === "string" && (call[0][0] as string).startsWith("Prepared by"),
    );
    expect(preparerCalls.length).toBe(0);
  });

  it("returns current rowCount", () => {
    const result = addHeaderRows(mockWorksheet as never, makeMeta(), "Report");
    expect(result).toBe(mockWorksheet.rowCount);
  });
});

// ================================================================
// addSectionRows
// ================================================================
describe("addSectionRows", () => {
  it("adds section title row with fill", () => {
    addSectionRows(mockWorksheet as never, makeSection());
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Test Section"]);
  });

  it("adds data rows with label and value", () => {
    addSectionRows(mockWorksheet as never, makeSection());
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Revenue", "100,000"]);
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Expenses", "50,000"]);
  });

  it("adds blank separator row at the end", () => {
    addSectionRows(mockWorksheet as never, makeSection());
    const lastCall = mockWorksheet.addRow.mock.calls[mockWorksheet.addRow.mock.calls.length - 1];
    expect(lastCall).toEqual([[]]);
  });
});

// ================================================================
// addTableRows
// ================================================================
describe("addTableRows", () => {
  it("adds table title row", () => {
    addTableRows(mockWorksheet as never, makeTable());
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Test Table"]);
  });

  it("adds header row with column names", () => {
    addTableRows(mockWorksheet as never, makeTable());
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Category", "Amount"]);
  });

  it("adds data rows", () => {
    addTableRows(mockWorksheet as never, makeTable());
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Materials", "30,000"]);
    expect(mockWorksheet.addRow).toHaveBeenCalledWith(["Fuel", "5,000"]);
  });

  it("adds blank separator row at the end", () => {
    addTableRows(mockWorksheet as never, makeTable());
    const lastCall = mockWorksheet.addRow.mock.calls[mockWorksheet.addRow.mock.calls.length - 1];
    expect(lastCall).toEqual([[]]);
  });
});

// ================================================================
// styleSheet
// ================================================================
describe("styleSheet", () => {
  it("iterates over columns to auto-width", () => {
    styleSheet(mockWorksheet as never);
    expect(mockColumn.eachCell).toHaveBeenCalled();
  });

  it("sets column width based on default maxLength when eachCell has no content", () => {
    const narrowColumn = { width: 5, eachCell: vi.fn() };
    const ws = {
      columns: [narrowColumn],
      getColumn: vi.fn(() => ({ width: 0 })),
    };
    styleSheet(ws as never);
    // eachCell is called; since callback never runs, maxLength stays at 12
    // column.width = Math.min(12 + 4, 50) = 16
    expect(narrowColumn.eachCell).toHaveBeenCalled();
    expect(narrowColumn.width).toBe(16);
  });

  it("invokes the eachCell callback and adjusts width based on cell content length", () => {
    const column = {
      width: 5,
      eachCell: vi.fn((opts: unknown, cb: (cell: { value: string }) => void) => {
        cb({ value: "A very long cell content string here" });
      }),
    };
    const ws = {
      columns: [column, column],
      getColumn: vi.fn(() => ({ width: 0 })),
    };
    styleSheet(ws as never);
    // "A very long cell content string here" = 36 chars
    // maxLength = max(12, 36) = 36, width = min(36 + 4, 50) = 40
    expect(column.width).toBe(40);
  });

  it("sets column 2 width to 20 when worksheet has fewer than 2 columns", () => {
    const singleColumn = { width: 5, eachCell: vi.fn() };
    const getColumnResult = { width: 0 };
    const ws = {
      columns: [singleColumn],
      getColumn: vi.fn(() => getColumnResult),
    };
    styleSheet(ws as never);
    expect(ws.getColumn).toHaveBeenCalledWith(2);
    expect(getColumnResult.width).toBe(20);
  });
});

// ================================================================
// saveWorkbook
// ================================================================
describe("saveWorkbook", () => {
  it("calls writeBuffer and saveAs with correct filename", async () => {
    await saveWorkbook(mockWorkbook as never, "test_report.xlsx");
    expect(mockWorkbook.xlsx.writeBuffer).toHaveBeenCalled();
    expect(mockSaveAs).toHaveBeenCalledWith(expect.any(Blob), "test_report.xlsx");
  });
});
