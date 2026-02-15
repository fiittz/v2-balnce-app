/** Activities where job start/end dates are relevant (site-based work) */
export const SITE_BASED_ACTIVITIES = [
  "carpentry_joinery", "general_construction", "electrical_contracting",
  "plumbing_heating", "bricklaying_masonry", "plastering_drylining",
  "painting_decorating", "roofing", "groundworks_civil", "landscaping",
  "tiling_stonework", "steel_fabrication_welding", "quantity_surveying",
  "project_management", "site_supervision", "property_maintenance",
  "property_development", "haulage_transport", "courier_delivery",
] as const;

export const PAYMENT_TERMS = [
  { value: "due_on_receipt", label: "Due on receipt", days: 0 },
  { value: "net_7", label: "Net 7", days: 7 },
  { value: "net_14", label: "Net 14", days: 14 },
  { value: "net_30", label: "Net 30", days: 30 },
  { value: "net_60", label: "Net 60", days: 60 },
  { value: "custom", label: "Custom date", days: null },
] as const;

export const UNIT_TYPES = [
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "items", label: "Items" },
  { value: "metres", label: "Metres" },
  { value: "sq_metres", label: "Sq Metres" },
  { value: "kg", label: "Kg" },
  { value: "litres", label: "Litres" },
  { value: "units", label: "Units" },
  { value: "fixed", label: "Fixed price" },
] as const;

export type PaymentTerm = typeof PAYMENT_TERMS[number]["value"];
export type UnitType = typeof UNIT_TYPES[number]["value"];
