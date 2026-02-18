import type { AbridgedAccountsReportData, ReportMeta, ReportSection } from "./types";
import { fmtEuro, fmtDate, fmtTaxYear } from "./formatters";

export interface AbridgedAccountsInput {
  companyName: string;
  croNumber: string;
  registeredAddress: string;
  accountingYearEnd: string; // e.g. "31 December 2025"
  directorNames: string[];
  companySecretaryName?: string; // Required when single director (Companies Act 2014)
  // Fixed Assets
  fixedAssetsTangible: number;
  // Current Assets
  stock: number;
  wip: number;
  debtors: number;
  prepayments: number;
  cashAtBank: number;
  // Current Liabilities
  creditors: number;
  accruals: number;
  taxation: number; // CT liability
  // Long-term Liabilities
  bankLoans: number;
  directorsLoans: number;
  directorsLoanDirection?: "to_company" | "from_company";
  // Capital & Reserves
  shareCapital: number; // default €100
  retainedProfits: number;
}

export function assembleAbridgedAccountsData(
  input: AbridgedAccountsInput,
  meta: ReportMeta,
): AbridgedAccountsReportData {
  const sections: ReportSection[] = [];

  // ── 1. Cover Page ────────────────────────────────────────
  sections.push({
    title: "Company Information",
    rows: [
      { label: "Company Name", value: input.companyName },
      { label: "CRO Number", value: input.croNumber },
      { label: "Registered Office", value: input.registeredAddress },
      { label: "Accounting Year End", value: input.accountingYearEnd },
      { label: "Directors", value: input.directorNames.join(", ") },
    ],
  });

  // ── 2. Directors' Responsibility Statement ───────────────
  sections.push({
    title: "Directors' Responsibility Statement",
    rows: [
      {
        label: "Statement",
        value:
          "The directors are responsible for ensuring that the company keeps or causes to be kept " +
          "adequate accounting records which correctly explain and record the transactions of the company, " +
          "enable at any time the assets, liabilities, financial position and profit or loss of the company " +
          "to be determined with reasonable accuracy, and enable the financial statements to be audited.",
      },
      {
        label: "Small Company Qualification",
        value:
          "The directors confirm that the company qualifies as a small company under Section 280A " +
          "of the Companies Act 2014 and has availed of the exemption contained in Section 352 " +
          "to file abridged financial statements.",
      },
      {
        label: "True and Fair View",
        value:
          "The directors acknowledge their responsibility to prepare financial statements that give " +
          "a true and fair view of the assets, liabilities, financial position and profit or loss of " +
          "the company and otherwise comply with the Companies Act 2014.",
      },
    ],
  });

  // ── 3. Accounting Policies ───────────────────────────────
  sections.push({
    title: "Accounting Policies",
    rows: [
      {
        label: "Basis of Preparation",
        value:
          "These financial statements have been prepared in accordance with FRS 102 " +
          '"The Financial Reporting Standard applicable in the UK and Republic of Ireland" ' +
          "(Section 1A — Small Entities) and the Companies Act 2014.",
      },
      {
        label: "Going Concern",
        value:
          "The financial statements have been prepared on the going concern basis. " +
          "The directors have a reasonable expectation that the company has adequate resources " +
          "to continue in operational existence for the foreseeable future.",
      },
      {
        label: "Turnover",
        value:
          "Turnover is recognised when the significant risks and rewards of ownership have " +
          "transferred, the amount of revenue can be reliably measured, and it is probable " +
          "that future economic benefits will flow to the entity.",
      },
      {
        label: "Tangible Fixed Assets",
        value:
          "Tangible fixed assets are stated at cost less accumulated depreciation. " +
          "Depreciation is provided at rates calculated to write off the cost of each asset " +
          "over its expected useful life.",
      },
      {
        label: "Stock",
        value:
          "Stock is valued at the lower of cost and net realisable value. " +
          "Work-in-progress is valued at the cost of direct materials and labour plus " +
          "attributable overheads based on normal activity levels.",
      },
    ],
  });

  // ── 4. Abridged Balance Sheet (Schedule 3A) ─────────────
  const fixedAssets = input.fixedAssetsTangible;

  const currentAssets = input.stock + input.wip + input.debtors + input.prepayments + input.cashAtBank;

  const currentLiabilities = input.creditors + input.accruals + input.taxation;

  const netCurrentAssets = currentAssets - currentLiabilities;

  const totalAssetsLessCurrentLiabilities = fixedAssets + netCurrentAssets;

  const longTermLiabilities = input.bankLoans + input.directorsLoans;

  const netAssets = totalAssetsLessCurrentLiabilities - longTermLiabilities;

  const shareholdersFunds = input.shareCapital + input.retainedProfits;

  sections.push({
    title: "Abridged Balance Sheet",
    rows: [
      { label: "FIXED ASSETS", value: "" },
      { label: "  Tangible assets", value: fmtEuro(fixedAssets) },
      { label: "", value: "" },
      { label: "CURRENT ASSETS", value: "" },
      { label: "  Stocks", value: fmtEuro(input.stock) },
      ...(input.wip > 0 ? [{ label: "  Work-in-progress", value: fmtEuro(input.wip) }] : []),
      { label: "  Debtors", value: fmtEuro(input.debtors) },
      ...(input.prepayments > 0
        ? [{ label: "  Prepayments and accrued income", value: fmtEuro(input.prepayments) }]
        : []),
      { label: "  Cash at bank and in hand", value: fmtEuro(input.cashAtBank) },
      { label: "  Total Current Assets", value: fmtEuro(currentAssets) },
      { label: "", value: "" },
      { label: "CREDITORS: amounts falling due within one year", value: "" },
      { label: "  Trade creditors", value: fmtEuro(input.creditors) },
      ...(input.accruals > 0 ? [{ label: "  Accruals and deferred income", value: fmtEuro(input.accruals) }] : []),
      ...(input.taxation > 0 ? [{ label: "  Taxation", value: fmtEuro(input.taxation) }] : []),
      { label: "  Total Current Liabilities", value: `(${fmtEuro(currentLiabilities)})` },
      { label: "", value: "" },
      { label: "NET CURRENT ASSETS / (LIABILITIES)", value: fmtEuro(netCurrentAssets) },
      { label: "", value: "" },
      { label: "TOTAL ASSETS LESS CURRENT LIABILITIES", value: fmtEuro(totalAssetsLessCurrentLiabilities) },
      ...(longTermLiabilities > 0
        ? [
            { label: "", value: "" },
            { label: "CREDITORS: amounts falling due after more than one year", value: "" },
            ...(input.bankLoans > 0 ? [{ label: "  Bank loans", value: fmtEuro(input.bankLoans) }] : []),
            ...(input.directorsLoans > 0
              ? [
                  {
                    label: `  Directors' loan${input.directorsLoanDirection === "from_company" ? " (due from company)" : ""}`,
                    value: fmtEuro(input.directorsLoans),
                  },
                ]
              : []),
            { label: "  Total Long-term Liabilities", value: `(${fmtEuro(longTermLiabilities)})` },
          ]
        : []),
      { label: "", value: "" },
      { label: "NET ASSETS", value: fmtEuro(netAssets) },
    ],
  });

  // ── 5. Capital & Reserves ────────────────────────────────
  sections.push({
    title: "Capital and Reserves",
    rows: [
      { label: "Called-up share capital", value: fmtEuro(input.shareCapital) },
      { label: "Profit and loss account", value: fmtEuro(input.retainedProfits) },
      { label: "SHAREHOLDERS' FUNDS", value: fmtEuro(shareholdersFunds) },
    ],
  });

  // ── 6. Notes to the Financial Statements ─────────────────
  const noteRows: { label: string; value: string }[] = [
    {
      label: "1. Accounting Standards",
      value:
        "The financial statements have been prepared in accordance with FRS 102 Section 1A " +
        "(Small Entities) and the Companies Act 2014.",
    },
    {
      label: "2. Share Capital",
      value: `Authorised and issued: ${fmtEuro(input.shareCapital)} in ordinary shares.`,
    },
  ];

  if (input.directorsLoans > 0) {
    noteRows.push({
      label: "3. Directors' Loans",
      value:
        `At the balance sheet date, the balance on the directors' loan account was ${fmtEuro(input.directorsLoans)}` +
        (input.directorsLoanDirection === "from_company"
          ? " (owed by the company to the directors)."
          : input.directorsLoanDirection === "to_company"
            ? " (owed to the company by the directors)."
            : "."),
    });
  }

  const approvalNoteNum = input.directorsLoans > 0 ? "4" : "3";
  noteRows.push({
    label: `${approvalNoteNum}. Approval`,
    value: `The financial statements were approved by the Board of Directors on ${fmtDate(meta.generatedDate)}.`,
  });

  sections.push({
    title: "Notes to the Financial Statements",
    rows: noteRows,
  });

  // ── 7. Audit Exemption Statement ─────────────────────────
  sections.push({
    title: "Audit Exemption Statement",
    rows: [
      {
        label: "Exemption",
        value:
          "The company is availing of the exemption from having its annual accounts audited " +
          "provided by Section 365 of the Companies Act 2014.",
      },
      {
        label: "Directors' Acknowledgement",
        value:
          "The directors have not required the company to obtain an audit of its financial statements " +
          "in accordance with Section 334 of the Companies Act 2014.",
      },
      {
        label: "Obligations",
        value:
          "The directors acknowledge their obligations under the Companies Act 2014 to keep " +
          "adequate accounting records, to prepare financial statements which give a true and " +
          "fair view of the state of affairs of the company, and to otherwise comply with the " +
          "provisions of the Companies Act 2014 relating to financial statements, so far as " +
          "they are applicable to the company.",
      },
    ],
  });

  return {
    meta,
    sections,
    directorNames: input.directorNames,
    companySecretaryName: input.companySecretaryName,
    croNumber: input.croNumber,
    registeredAddress: input.registeredAddress,
    accountingYearEnd: input.accountingYearEnd,
    fixedAssets,
    currentAssets,
    currentLiabilities,
    netCurrentAssets,
    longTermLiabilities,
    netAssets,
    shareCapital: input.shareCapital,
    retainedProfits: input.retainedProfits,
    shareholdersFunds,
  };
}
