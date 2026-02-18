import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateInvoiceHTML, InvoiceHTMLData } from "../invoiceHtml";

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

/** Minimal valid data object – tests can spread-override individual fields. */
function makeData(overrides: Partial<InvoiceHTMLData> = {}): InvoiceHTMLData {
  return {
    supplierName: "Acme Construction Ltd",
    supplierAddress: "123 Main Street, Dublin 2",
    supplierVatNumber: "IE1234567T",
    supplierPhone: "+353 1 234 5678",
    customerName: "Jane Client",
    customerEmail: "jane@example.com",
    customerPhone: "+353 87 123 4567",
    customerAddress: "456 Oak Ave, Cork",
    customerTaxNumber: "IE9876543W",
    invoiceDate: "2025-03-15",
    dueDate: "2025-04-14",
    items: [
      {
        description: "Carpentry work",
        qty: 10,
        price: 50,
        vatRate: "standard_23",
        lineTotal: 500,
        vat_amount: 115,
        total_amount: 615,
      },
    ],
    subtotal: 500,
    vatAmount: 115,
    total: 615,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// 1. Basic invoice HTML generation with all fields
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – basic generation", () => {
  it("returns a complete HTML document", () => {
    const html = generateInvoiceHTML(makeData());

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("</html>");
  });

  it("contains the supplier name in an h1", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("<h1>Acme Construction Ltd</h1>");
  });

  it("contains the supplier address", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("123 Main Street, Dublin 2");
  });

  it("contains the supplier phone", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("Tel: +353 1 234 5678");
  });

  it("contains the supplier VAT number in the header", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("<strong>VAT No: IE1234567T</strong>");
  });

  it("contains the supplier VAT number in the footer", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("VAT Registration: IE1234567T");
  });

  it("contains the customer details", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("<strong>Jane Client</strong>");
    expect(html).toContain("jane@example.com");
    expect(html).toContain("Tel: +353 87 123 4567");
    expect(html).toContain("456 Oak Ave, Cork");
    expect(html).toContain("IE9876543W");
  });

  it("shows 'INVOICE' as the default title", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("<h2>INVOICE</h2>");
  });

  it("defaults the invoice number to PREVIEW", () => {
    const html = generateInvoiceHTML(makeData({ invoiceNumber: undefined }));
    expect(html).toContain("#PREVIEW");
  });

  it("uses a provided invoice number", () => {
    const html = generateInvoiceHTML(makeData({ invoiceNumber: "INV-0042" }));
    expect(html).toContain("#INV-0042");
    expect(html).toContain("<title>Invoice INV-0042</title>");
  });

  it("contains the thank-you footer", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("Thank you for your business!");
  });
});

// ══════════════════════════════════════════════════════════════
// 2. Quote type
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – quote type", () => {
  it('shows "QUOTE" when invoiceType is "quote"', () => {
    const html = generateInvoiceHTML(makeData({ invoiceType: "quote" }));
    expect(html).toContain("<h2>QUOTE</h2>");
    expect(html).not.toContain("<h2>INVOICE</h2>");
  });

  it('shows "INVOICE" when invoiceType is "invoice"', () => {
    const html = generateInvoiceHTML(makeData({ invoiceType: "invoice" }));
    expect(html).toContain("<h2>INVOICE</h2>");
    expect(html).not.toContain("<h2>QUOTE</h2>");
  });

  it('defaults to "INVOICE" when invoiceType is omitted', () => {
    const html = generateInvoiceHTML(makeData({ invoiceType: undefined }));
    expect(html).toContain("<h2>INVOICE</h2>");
  });
});

// ══════════════════════════════════════════════════════════════
// 3. VAT rate label mapping
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – VAT rate labels", () => {
  const rateTests: [string, string][] = [
    ["standard_23", "23%"],
    ["reduced_13_5", "13.5%"],
    ["second_reduced_9", "9%"],
    ["livestock_4_8", "4.8%"],
    ["zero_rated", "0%"],
    ["exempt", "Exempt"],
  ];

  rateTests.forEach(([rateKey, expectedLabel]) => {
    it(`maps "${rateKey}" to "${expectedLabel}"`, () => {
      const html = generateInvoiceHTML(
        makeData({
          items: [
            {
              description: "Test item",
              qty: 1,
              price: 100,
              vatRate: rateKey,
              lineTotal: 100,
              vat_amount: 0,
              total_amount: 100,
            },
          ],
        }),
      );
      expect(html).toContain(`>${expectedLabel}</td>`);
    });
  });

  it("falls back to the raw vatRate string for unknown rates", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [
          {
            description: "Mystery item",
            qty: 1,
            price: 100,
            vatRate: "special_15",
            lineTotal: 100,
            vat_amount: 15,
            total_amount: 115,
          },
        ],
      }),
    );
    expect(html).toContain(">special_15</td>");
  });
});

// ══════════════════════════════════════════════════════════════
// 4. Currency formatting (EUR / en-IE)
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – currency formatting", () => {
  it("formats the subtotal as EUR currency", () => {
    const html = generateInvoiceHTML(makeData({ subtotal: 1234.5 }));
    // en-IE EUR format: €1,234.50
    expect(html).toContain("€1,234.50");
  });

  it("formats zero correctly", () => {
    const html = generateInvoiceHTML(
      makeData({
        subtotal: 0,
        vatAmount: 0,
        total: 0,
        items: [
          {
            description: "Free item",
            qty: 1,
            price: 0,
            vatRate: "zero_rated",
            lineTotal: 0,
            vat_amount: 0,
            total_amount: 0,
          },
        ],
      }),
    );
    expect(html).toContain("€0.00");
  });

  it("formats item unit prices correctly", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [
          {
            description: "Widget",
            qty: 3,
            price: 99.99,
            vatRate: "standard_23",
            lineTotal: 299.97,
            vat_amount: 68.99,
            total_amount: 368.96,
          },
        ],
      }),
    );
    expect(html).toContain("€99.99");
    expect(html).toContain("€368.96");
  });

  it("formats large amounts with comma grouping", () => {
    const html = generateInvoiceHTML(makeData({ total: 12345.67 }));
    expect(html).toContain("€12,345.67");
  });
});

// ══════════════════════════════════════════════════════════════
// 5. Date formatting (en-IE locale)
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – date formatting", () => {
  it("formats the invoice date in en-IE long format", () => {
    const html = generateInvoiceHTML(makeData({ invoiceDate: "2025-03-15" }));
    // en-IE long format: 15 March 2025
    expect(html).toContain("15 March 2025");
  });

  it("formats the due date in en-IE long format", () => {
    const html = generateInvoiceHTML(makeData({ dueDate: "2025-04-14" }));
    expect(html).toContain("14 April 2025");
  });

  it("shows supply date when different from invoice date", () => {
    const html = generateInvoiceHTML(makeData({ invoiceDate: "2025-03-15", supplyDate: "2025-03-10" }));
    expect(html).toContain("Date of Supply");
    expect(html).toContain("10 March 2025");
  });

  it("hides supply date when it equals the invoice date", () => {
    const html = generateInvoiceHTML(makeData({ invoiceDate: "2025-03-15", supplyDate: "2025-03-15" }));
    expect(html).not.toContain("Date of Supply");
  });

  it("hides supply date when not provided", () => {
    const html = generateInvoiceHTML(makeData({ supplyDate: undefined }));
    expect(html).not.toContain("Date of Supply");
  });
});

// ══════════════════════════════════════════════════════════════
// 6. RCT handling
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – RCT handling", () => {
  const rctData: Partial<InvoiceHTMLData> = {
    rctEnabled: true,
    rctRate: 20,
    rctAmount: 100,
    subtotal: 500,
    vatAmount: 115,
    total: 615,
  };

  it('shows "€0.00" for VAT when RCT is enabled', () => {
    const html = generateInvoiceHTML(makeData(rctData));
    expect(html).toContain("VAT (Reverse Charge)");
    expect(html).toContain(">€0.00</span>");
  });

  it("shows the reverse charge legal note", () => {
    const html = generateInvoiceHTML(makeData(rctData));
    expect(html).toContain("VAT reverse charge applies per s.12(1)(b) VATCA 2010");
  });

  it("shows the RCT deduction row with rate and amount", () => {
    const html = generateInvoiceHTML(makeData(rctData));
    expect(html).toContain("RCT Deduction (20%)");
    expect(html).toContain("-€100.00");
  });

  it("applies the rct CSS class to the deduction row", () => {
    const html = generateInvoiceHTML(makeData(rctData));
    expect(html).toContain('class="totals-row rct"');
  });

  it('calculates and displays "Net Receivable" (total minus rctAmount)', () => {
    const html = generateInvoiceHTML(makeData(rctData));
    // total=615, rctAmount=100 => Net Receivable = 515
    expect(html).toContain("Net Receivable");
    expect(html).toContain("€515.00");
  });

  it('shows "Total Due" when RCT is disabled', () => {
    const html = generateInvoiceHTML(makeData({ rctEnabled: false }));
    expect(html).toContain("Total Due");
    expect(html).not.toContain("Net Receivable");
    expect(html).not.toContain("RCT Deduction");
    expect(html).not.toContain("Reverse Charge");
  });

  it("does not show RCT section when rctEnabled defaults to false", () => {
    const html = generateInvoiceHTML(makeData({ rctEnabled: undefined }));
    expect(html).toContain("Total Due");
    expect(html).not.toContain("RCT Deduction");
  });
});

// ══════════════════════════════════════════════════════════════
// 7. Status badge classes
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – status badges", () => {
  it("does not render a badge for draft status", () => {
    const html = generateInvoiceHTML(makeData({ status: "draft" }));
    expect(html).not.toContain('<span class="status-badge');
  });

  it('renders "sent" badge with correct class', () => {
    const html = generateInvoiceHTML(makeData({ status: "sent" }));
    expect(html).toContain('class="status-badge status-sent"');
    expect(html).toContain(">sent</span>");
  });

  it('renders "paid" badge with correct class', () => {
    const html = generateInvoiceHTML(makeData({ status: "paid" }));
    expect(html).toContain('class="status-badge status-paid"');
    expect(html).toContain(">paid</span>");
  });

  it('renders "overdue" badge with correct class', () => {
    const html = generateInvoiceHTML(makeData({ status: "overdue" }));
    expect(html).toContain('class="status-badge status-overdue"');
    expect(html).toContain(">overdue</span>");
  });

  it("defaults to draft (no badge) when status is omitted", () => {
    const html = generateInvoiceHTML(makeData({ status: undefined }));
    expect(html).not.toContain('<span class="status-badge');
  });
});

// ══════════════════════════════════════════════════════════════
// 8. Missing / empty optional fields
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – optional field handling", () => {
  it("omits supplier address line when empty", () => {
    const html = generateInvoiceHTML(makeData({ supplierAddress: "" }));
    // The conditional uses: supplierAddress ? `${supplierAddress}<br>` : ""
    // So the address text should not appear
    expect(html).not.toContain("123 Main Street");
  });

  it("omits supplier phone when empty", () => {
    const html = generateInvoiceHTML(makeData({ supplierPhone: "" }));
    expect(html).not.toContain("Tel: +353 1 234 5678");
  });

  it("omits supplier VAT number when empty", () => {
    const html = generateInvoiceHTML(makeData({ supplierVatNumber: "", customerTaxNumber: "" }));
    expect(html).not.toContain("VAT No:");
    expect(html).not.toContain("VAT Registration:");
  });

  it("omits customer email when empty", () => {
    const html = generateInvoiceHTML(makeData({ customerEmail: "" }));
    expect(html).not.toContain("jane@example.com");
  });

  it("omits customer phone when empty", () => {
    const html = generateInvoiceHTML(makeData({ customerPhone: "" }));
    expect(html).not.toContain("Tel: +353 87 123 4567");
  });

  it("omits customer address when empty", () => {
    const html = generateInvoiceHTML(makeData({ customerAddress: "" }));
    expect(html).not.toContain("456 Oak Ave, Cork");
  });

  it("omits customer tax number when empty", () => {
    const html = generateInvoiceHTML(makeData({ customerTaxNumber: "" }));
    expect(html).not.toContain("Tax/VAT No:");
  });

  it('falls back to "Customer Name" when customerName is empty', () => {
    const html = generateInvoiceHTML(makeData({ customerName: "" }));
    expect(html).toContain("<strong>Customer Name</strong>");
  });

  it("produces valid HTML even with all optional fields omitted", () => {
    const html = generateInvoiceHTML({
      supplierName: "Minimal Co",
      customerName: "Some Client",
      invoiceDate: "2025-01-01",
      items: [
        {
          description: "Service",
          qty: 1,
          price: 100,
          vatRate: "standard_23",
          lineTotal: 100,
          vat_amount: 23,
          total_amount: 123,
        },
      ],
      subtotal: 100,
      vatAmount: 23,
      total: 123,
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("Minimal Co");
    expect(html).toContain("Some Client");
  });
});

// ══════════════════════════════════════════════════════════════
// 9. Notes / comments section
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – notes and comments", () => {
  it("renders a notes section when comment is provided", () => {
    const html = generateInvoiceHTML(makeData({ comment: "Payment within 14 days please." }));
    expect(html).toContain('class="notes-section"');
    expect(html).toContain("<h3>Notes</h3>");
    expect(html).toContain("Payment within 14 days please.");
  });

  it("renders a notes section when notes is provided", () => {
    const html = generateInvoiceHTML(makeData({ comment: undefined, notes: "Stage 2 of 3 payments." }));
    expect(html).toContain('class="notes-section"');
    expect(html).toContain("Stage 2 of 3 payments.");
  });

  it("prefers comment over notes when both are provided", () => {
    const html = generateInvoiceHTML(makeData({ comment: "Use comment", notes: "Use notes" }));
    expect(html).toContain("Use comment");
    expect(html).not.toContain("Use notes");
  });

  it("does not render notes section when both comment and notes are absent", () => {
    const html = generateInvoiceHTML(makeData({ comment: undefined, notes: undefined }));
    expect(html).not.toContain('class="notes-section"');
  });

  it("does not render notes section when both are empty strings", () => {
    const html = generateInvoiceHTML(makeData({ comment: "", notes: "" }));
    expect(html).not.toContain('class="notes-section"');
  });
});

// ══════════════════════════════════════════════════════════════
// 10. Items table
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – items table", () => {
  it("renders table headers", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("<th>Description</th>");
    expect(html).toContain("<th>Qty</th>");
    expect(html).toContain("<th>Unit Price</th>");
    expect(html).toContain("<th>VAT Rate</th>");
    expect(html).toContain("<th>Total</th>");
  });

  it("renders a single item row with correct values", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("Carpentry work");
    expect(html).toContain(">10</td>");
    expect(html).toContain("€50.00");
    expect(html).toContain(">23%</td>");
    expect(html).toContain("€615.00");
  });

  it("renders multiple item rows", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [
          {
            description: "Framing",
            qty: 5,
            price: 80,
            vatRate: "standard_23",
            lineTotal: 400,
            vat_amount: 92,
            total_amount: 492,
          },
          {
            description: "Finishing",
            qty: 3,
            price: 120,
            vatRate: "reduced_13_5",
            lineTotal: 360,
            vat_amount: 48.6,
            total_amount: 408.6,
          },
          {
            description: "Materials",
            qty: 1,
            price: 250,
            vatRate: "zero_rated",
            lineTotal: 250,
            vat_amount: 0,
            total_amount: 250,
          },
        ],
      }),
    );
    expect(html).toContain("Framing");
    expect(html).toContain("Finishing");
    expect(html).toContain("Materials");
    expect(html).toContain(">5</td>");
    expect(html).toContain(">3</td>");
    expect(html).toContain("€80.00");
    expect(html).toContain("€120.00");
    expect(html).toContain("€250.00");
    expect(html).toContain(">13.5%</td>");
    expect(html).toContain(">0%</td>");
  });

  it("renders item rows inside the tbody", () => {
    const html = generateInvoiceHTML(makeData());
    const tbodyStart = html.indexOf("<tbody>");
    const tbodyEnd = html.indexOf("</tbody>");
    const tbodyContent = html.slice(tbodyStart, tbodyEnd);
    expect(tbodyContent).toContain("Carpentry work");
  });
});

// ══════════════════════════════════════════════════════════════
// 11. Default due date (+30 days)
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – default due date", () => {
  beforeEach(() => {
    // Fix Date.now to 2025-06-01T00:00:00.000Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a +30-day due date when dueDate is not provided", () => {
    const html = generateInvoiceHTML(makeData({ dueDate: undefined }));
    // 2025-06-01 + 30 days = 2025-07-01
    expect(html).toContain("1 July 2025");
  });

  it("uses the explicit dueDate when provided", () => {
    const html = generateInvoiceHTML(makeData({ dueDate: "2025-12-25" }));
    expect(html).toContain("25 December 2025");
    expect(html).not.toContain("1 July 2025");
  });
});

// ══════════════════════════════════════════════════════════════
// 12. XSS safety / structural correctness
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – structural HTML correctness", () => {
  it("produces well-structured HTML with head and body", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("<head>");
    expect(html).toContain("</head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
  });

  it("includes charset and viewport meta tags", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<meta name="viewport"');
  });

  it("embeds content into an inline template (no unmatched tags)", () => {
    const html = generateInvoiceHTML(makeData());
    // Count opening and closing table tags
    const tableOpens = (html.match(/<table[\s>]/g) || []).length;
    const tableCloses = (html.match(/<\/table>/g) || []).length;
    expect(tableOpens).toBe(tableCloses);

    const divOpens = (html.match(/<div[\s>]/g) || []).length;
    const divCloses = (html.match(/<\/div>/g) || []).length;
    expect(divOpens).toBe(divCloses);
  });

  it("places user-supplied text in the expected locations", () => {
    // Angle brackets in user input are rendered as-is (template literal).
    // This test documents the current behavior; a real app should sanitize.
    const html = generateInvoiceHTML(
      makeData({
        supplierName: "O'Brien & Sons",
        customerName: "Test <b>bold</b>",
      }),
    );
    // The values are embedded directly via template literal
    expect(html).toContain("O'Brien & Sons");
    expect(html).toContain("Test <b>bold</b>");
  });

  it("renders a complete style block", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("<style>");
    expect(html).toContain("</style>");
    expect(html).toContain(".status-draft");
    expect(html).toContain(".status-sent");
    expect(html).toContain(".status-paid");
    expect(html).toContain(".status-overdue");
  });
});

// ══════════════════════════════════════════════════════════════
// 13. Empty items array
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – empty items array", () => {
  it("produces valid HTML with an empty tbody", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [],
        subtotal: 0,
        vatAmount: 0,
        total: 0,
      }),
    );
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<tbody>");
    expect(html).toContain("</tbody>");
  });

  it("has no <tr> elements inside the tbody when items is empty", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [],
        subtotal: 0,
        vatAmount: 0,
        total: 0,
      }),
    );
    const tbodyStart = html.indexOf("<tbody>");
    const tbodyEnd = html.indexOf("</tbody>");
    const tbodyContent = html.slice(tbodyStart + "<tbody>".length, tbodyEnd);
    expect(tbodyContent.trim()).toBe("");
  });

  it("still renders the totals section with zero amounts", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [],
        subtotal: 0,
        vatAmount: 0,
        total: 0,
      }),
    );
    expect(html).toContain("Net Amount");
    expect(html).toContain("Total Due");
    expect(html).toContain("€0.00");
  });

  it("still renders the table headers", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [],
        subtotal: 0,
        vatAmount: 0,
        total: 0,
      }),
    );
    expect(html).toContain("<th>Description</th>");
    expect(html).toContain("<th>Qty</th>");
  });
});

// ══════════════════════════════════════════════════════════════
// Additional edge cases
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – additional edge cases", () => {
  it("handles negative amounts (credit notes)", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [
          {
            description: "Credit adjustment",
            qty: 1,
            price: -200,
            vatRate: "standard_23",
            lineTotal: -200,
            vat_amount: -46,
            total_amount: -246,
          },
        ],
        subtotal: -200,
        vatAmount: -46,
        total: -246,
      }),
    );
    expect(html).toContain("-€200.00");
    expect(html).toContain("-€246.00");
  });

  it("renders both the VAT label and the Net Amount label in totals", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("Net Amount");
    expect(html).toContain(">VAT</span>");
  });

  it("includes print media query styles", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("@media print");
    expect(html).toContain(".no-print");
  });

  it("includes the Nunito font import", () => {
    const html = generateInvoiceHTML(makeData());
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("Nunito");
  });

  it("renders RCT with 0% rate correctly", () => {
    const html = generateInvoiceHTML(
      makeData({
        rctEnabled: true,
        rctRate: 0,
        rctAmount: 0,
        total: 615,
      }),
    );
    expect(html).toContain("RCT Deduction (0%)");
    expect(html).toContain("Net Receivable");
    // Net receivable = 615 - 0 = 615
    expect(html).toContain("€615.00");
  });
});

// ══════════════════════════════════════════════════════════════
// Unit type label mapping (line 116)
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – unit type labels", () => {
  it("maps 'hours' to 'Hours'", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [
          {
            description: "Consulting",
            qty: 8,
            price: 75,
            vatRate: "standard_23",
            unitType: "hours",
            lineTotal: 600,
            vat_amount: 138,
            total_amount: 738,
          },
        ],
      }),
    );
    expect(html).toContain(">Hours</td>");
  });

  it("maps 'sq_metres' to 'Sq M'", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [
          {
            description: "Flooring",
            qty: 50,
            price: 20,
            vatRate: "reduced_13_5",
            unitType: "sq_metres",
            lineTotal: 1000,
            vat_amount: 135,
            total_amount: 1135,
          },
        ],
      }),
    );
    expect(html).toContain(">Sq M</td>");
  });

  it("falls back to 'Items' for unknown unitType", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [
          {
            description: "Widget",
            qty: 1,
            price: 50,
            vatRate: "standard_23",
            unitType: "unknown_unit",
            lineTotal: 50,
            vat_amount: 11.5,
            total_amount: 61.5,
          },
        ],
      }),
    );
    expect(html).toContain(">Items</td>");
  });

  it("defaults to 'Items' when unitType is undefined", () => {
    const html = generateInvoiceHTML(
      makeData({
        items: [
          {
            description: "Service",
            qty: 1,
            price: 100,
            vatRate: "standard_23",
            lineTotal: 100,
            vat_amount: 23,
            total_amount: 123,
          },
        ],
      }),
    );
    expect(html).toContain(">Items</td>");
  });
});

// ══════════════════════════════════════════════════════════════
// PO Number display (line 221)
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – PO number", () => {
  it("shows PO Number when provided", () => {
    const html = generateInvoiceHTML(makeData({ customerPoNumber: "PO-12345" }));
    expect(html).toContain("PO Number");
    expect(html).toContain("PO-12345");
  });

  it("hides PO Number when not provided", () => {
    const html = generateInvoiceHTML(makeData({ customerPoNumber: undefined }));
    expect(html).not.toContain("PO Number");
  });
});

// ══════════════════════════════════════════════════════════════
// Payment details / IBAN section (lines 270-275)
// ══════════════════════════════════════════════════════════════
describe("generateInvoiceHTML – payment details", () => {
  it("shows IBAN and BIC when both provided", () => {
    const html = generateInvoiceHTML(makeData({ supplierIban: "IE29AIBK93115212345678", supplierBic: "AIBKIE2D" }));
    expect(html).toContain("Payment Details");
    expect(html).toContain("IBAN");
    expect(html).toContain("IE29AIBK93115212345678");
    expect(html).toContain("BIC");
    expect(html).toContain("AIBKIE2D");
  });

  it("shows IBAN without BIC when BIC is empty", () => {
    const html = generateInvoiceHTML(makeData({ supplierIban: "IE29AIBK93115212345678", supplierBic: "" }));
    expect(html).toContain("IBAN");
    expect(html).toContain("IE29AIBK93115212345678");
    expect(html).not.toContain("BIC");
  });

  it("hides payment details when IBAN is empty", () => {
    const html = generateInvoiceHTML(makeData({ supplierIban: "" }));
    expect(html).not.toContain("Payment Details");
  });
});
