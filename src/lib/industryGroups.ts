/**
 * Industry group mapping — maps primary_activity / business_type values
 * to canonical industry group keys used for category seeding and relief suggestions.
 *
 * Pure module, no Supabase dependency.
 */

export type IndustryGroup =
  | "construction"
  | "technology"
  | "software_dev"
  | "events"
  | "hospitality"
  | "retail"
  | "transport"
  | "health"
  | "property"
  | "manufacturing"
  | "professional";

// Map primary_activity values → industry group key
export const ACTIVITY_TO_GROUP: Record<string, IndustryGroup> = {
  // Construction
  carpentry_joinery: "construction",
  general_construction: "construction",
  electrical_contracting: "construction",
  plumbing_heating: "construction",
  bricklaying_masonry: "construction",
  plastering_drylining: "construction",
  painting_decorating: "construction",
  roofing: "construction",
  groundworks_civil: "construction",
  landscaping: "construction",
  tiling_stonework: "construction",
  steel_fabrication_welding: "construction",
  property_maintenance: "construction",

  // Hospitality
  cafe_restaurant: "hospitality",
  takeaway: "hospitality",
  catering: "hospitality",
  mobile_food: "hospitality",

  // Retail
  physical_retail: "retail",
  online_retail: "retail",
  market_stall: "retail",
  wholesale_distribution: "retail",

  // Transport
  haulage_hgv: "transport",
  courier_services: "transport",
  taxi_private_hire: "transport",
  delivery_services: "transport",
  plant_hire: "transport",

  // Technology (general IT/digital)
  it_services: "technology",
  web_design: "technology",
  digital_marketing: "technology",
  content_creation: "technology",

  // Software Development (pure dev)
  software_development: "software_dev",

  // Events
  event_hosting: "events",
  event_management: "events",

  // Health
  beauty_wellness: "health",
  fitness_sports: "health",
  care_services: "health",

  // Property
  property_development: "property",
  letting_property_management: "property",
  quantity_surveying: "property",

  // Manufacturing
  manufacturing: "manufacturing",
  bespoke_fabrication: "manufacturing",
  food_production: "manufacturing",

  // Professional (default)
  accounting_bookkeeping: "professional",
  legal_services: "professional",
  consultancy: "professional",
  hr_recruitment: "professional",
  financial_services: "professional",
  insurance_broker: "professional",
  architecture: "professional",
  engineering_consultancy: "professional",
  graphic_design: "professional",
  photography_videography: "professional",
  training_provider: "professional",
  coaching_mentoring: "professional",
  tutoring: "professional",
  cleaning: "professional",
  waste_removal: "professional",
  pest_control: "professional",
  farming: "professional",
  forestry: "professional",
  agricultural_contracting: "professional",
  project_management: "professional",
  site_supervision: "professional",

  // Legacy enum values from database (profiles.business_type)
  construction: "construction",
  electrical: "construction",
  landscaping_groundworks: "construction",
  manufacturing_enum: "manufacturing",
  retail_ecommerce: "retail",
  hospitality: "hospitality",
  professional_services: "professional",
  transport_logistics: "transport",
  health_wellness: "health",
  technology_it: "technology",
  real_estate_property: "property",
  maintenance_facilities: "construction",
};

export function getIndustryGroup(businessType: string | null | undefined): IndustryGroup {
  if (!businessType) return "professional";
  return ACTIVITY_TO_GROUP[businessType] || "professional";
}
