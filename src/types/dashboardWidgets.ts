export type WidgetId =
  | "welcome_hero"
  | "quick_actions"
  | "vat_overview"
  | "income_summary"
  | "expenses_summary"
  | "bank_feed_status"
  | "uncategorised_transactions"
  | "pending_tasks"
  | "income_vs_expenses_chart"
  | "automation_insights"
  | "rct_overview"
  | "construction_materials_labour"
  | "tax_deadlines"
  | "eu_international_overview";

export type WidgetCategory = "overview" | "financial" | "tasks" | "charts" | "construction";

export type WidgetPreferences = Partial<Record<WidgetId, boolean>>;

export interface WidgetDefinition {
  id: WidgetId;
  label: string;
  description: string;
  category: WidgetCategory;
  defaultVisible: boolean;
  conditionalOn?: {
    vatRegistered?: boolean;
    rctRegistered?: boolean;
    euTradeEnabled?: boolean;
    businessTypes?: string[];
  };
}

const CONSTRUCTION_TRADES = [
  "carpenter",
  "joiner",
  "builder",
  "plumber",
  "electrician",
  "plasterer",
  "painter",
  "roofer",
  "tiler",
  "construction",
];

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    id: "welcome_hero",
    label: "Welcome Banner",
    description: "Greeting with your business name and summary",
    category: "overview",
    defaultVisible: true,
  },
  {
    id: "quick_actions",
    label: "Quick Actions",
    description: "Shortcut buttons for common tasks",
    category: "overview",
    defaultVisible: true,
  },
  {
    id: "vat_overview",
    label: "VAT Overview",
    description: "VAT collected, paid, and net amount due",
    category: "financial",
    defaultVisible: true,
    conditionalOn: { vatRegistered: true },
  },
  {
    id: "income_summary",
    label: "Income Summary",
    description: "Total income with sparkline trend",
    category: "financial",
    defaultVisible: true,
  },
  {
    id: "expenses_summary",
    label: "Expenses Summary",
    description: "Total expenses with sparkline trend",
    category: "financial",
    defaultVisible: true,
  },
  {
    id: "bank_feed_status",
    label: "Bank Feed Status",
    description: "Status of your connected bank feeds",
    category: "overview",
    defaultVisible: true,
  },
  {
    id: "uncategorised_transactions",
    label: "Transactions to Review",
    description: "Transactions that need categorisation",
    category: "tasks",
    defaultVisible: true,
  },
  {
    id: "pending_tasks",
    label: "Pending Tasks",
    description: "Outstanding items requiring attention",
    category: "tasks",
    defaultVisible: true,
  },
  {
    id: "income_vs_expenses_chart",
    label: "Income vs Expenses",
    description: "Visual comparison of income and expenses",
    category: "charts",
    defaultVisible: true,
  },
  {
    id: "automation_insights",
    label: "Automation Insights",
    description: "AI categorisation accuracy and stats",
    category: "overview",
    defaultVisible: true,
  },
  {
    id: "rct_overview",
    label: "RCT Overview",
    description: "Relevant Contracts Tax status and summary",
    category: "construction",
    defaultVisible: true,
    conditionalOn: { rctRegistered: true, businessTypes: CONSTRUCTION_TRADES },
  },
  {
    id: "construction_materials_labour",
    label: "Materials vs Labour",
    description: "Breakdown of materials and labour costs",
    category: "construction",
    defaultVisible: true,
    conditionalOn: { businessTypes: CONSTRUCTION_TRADES },
  },
  {
    id: "tax_deadlines",
    label: "Deadlines",
    description: "Upcoming VAT, CT1, and Form 11 deadlines",
    category: "tasks",
    defaultVisible: true,
  },
  {
    id: "eu_international_overview",
    label: "EU & International",
    description: "Cross-border VAT trade summary and obligations",
    category: "financial",
    defaultVisible: true,
    conditionalOn: { vatRegistered: true, euTradeEnabled: true },
  },
];

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  overview: "Overview",
  financial: "Financial",
  tasks: "Tasks",
  charts: "Charts",
  construction: "Construction",
};
