// MCC (Merchant Category Code) to autocat category/VAT mapping.
// Used as fallback when vendor name doesn't match.
// Based on ISO 18245 and Visa/Mastercard MCC lists, mapped to Irish VAT rules.

export interface MCCMapping {
  code: number;
  description: string;
  category: string;
  vat_type: string;
  vat_deductible: boolean;
  isTradeSupplier?: boolean;
  needs_receipt?: boolean;
  relief_type?: "medical" | "pension" | "health_insurance" | "rent" | "charitable" | "tuition" | null;
}

// MCC code ranges and their mappings
export const mccMappings: MCCMapping[] = [
  // ── Agricultural / Contract Services ──
  { code: 763, description: "Agricultural Co-operatives", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 780, description: "Landscaping/Horticultural", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },

  // ── Construction / Trade ──
  { code: 1520, description: "General Contractors", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 1711, description: "Heating/Plumbing/AC Contractors", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 1731, description: "Electrical Contractors", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 1740, description: "Masonry/Stonework/Tile", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 1750, description: "Carpentry Contractors", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 1761, description: "Roofing/Siding/Sheet Metal", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 1771, description: "Concrete Work Contractors", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 1799, description: "Special Trade Contractors", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },

  // ── Airlines ──
  { code: 3000, description: "Airlines (general)", category: "Travel & Subsistence", vat_type: "Zero", vat_deductible: true },
  { code: 3148, description: "Aer Lingus", category: "Travel & Subsistence", vat_type: "Zero", vat_deductible: true },
  { code: 3246, description: "Ryanair", category: "Travel & Subsistence", vat_type: "Zero", vat_deductible: true },
  { code: 4511, description: "Airlines/Air Carriers", category: "Travel & Subsistence", vat_type: "Zero", vat_deductible: true },

  // ── Car Rental ──
  { code: 3351, description: "Car Rental (general)", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true, needs_receipt: true },
  { code: 7512, description: "Car Rental", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true, needs_receipt: true },

  // ── Hotels / Accommodation ──
  { code: 3501, description: "Hotels (general)", category: "Subsistence", vat_type: "Reduced 13.5%", vat_deductible: false },
  { code: 7011, description: "Hotels/Motels/Resorts", category: "Subsistence", vat_type: "Reduced 13.5%", vat_deductible: false },
  { code: 7012, description: "Timeshares", category: "Subsistence", vat_type: "Reduced 13.5%", vat_deductible: false },

  // ── Transportation ──
  { code: 4011, description: "Railways", category: "Motor/travel", vat_type: "Zero", vat_deductible: true },
  { code: 4111, description: "Local Commuter Transport", category: "Motor/travel", vat_type: "Zero", vat_deductible: true },
  { code: 4112, description: "Passenger Railways", category: "Motor/travel", vat_type: "Zero", vat_deductible: true },
  { code: 4121, description: "Taxicabs/Limousines", category: "Motor/travel", vat_type: "Reduced 13.5%", vat_deductible: true, needs_receipt: true },
  { code: 4131, description: "Bus Lines", category: "Motor/travel", vat_type: "Zero", vat_deductible: true },
  { code: 4214, description: "Motor Freight/Delivery", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4215, description: "Courier Services", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4411, description: "Steamship/Cruise Lines", category: "Motor/travel", vat_type: "Zero", vat_deductible: true },
  { code: 4457, description: "Boat Rental/Leasing", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4468, description: "Marinas/Marine Service", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4722, description: "Travel Agencies", category: "Travel & Subsistence", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4784, description: "Bridge and Road Tolls", category: "Motor/travel", vat_type: "Zero", vat_deductible: true },
  { code: 4789, description: "Transportation (other)", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },

  // ── Utilities ──
  { code: 4812, description: "Telecommunication Equipment", category: "Phone", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4814, description: "Telecommunication Services", category: "Phone", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4816, description: "Computer Network/Information Services", category: "Software", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4821, description: "Telegraph Services", category: "Phone", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4829, description: "Wire Transfers/Money Orders", category: "Bank fees", vat_type: "Exempt", vat_deductible: false },
  { code: 4899, description: "Cable/Pay TV", category: "Phone", vat_type: "Standard 23%", vat_deductible: true },
  { code: 4900, description: "Utilities (Electric/Gas/Water/Sanitary)", category: "General Expenses", vat_type: "Standard 23%", vat_deductible: true, needs_receipt: true },

  // ── Retail - Hardware / Building ──
  { code: 5013, description: "Motor Vehicle Supplies/Parts (wholesale)", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5021, description: "Office/Commercial Furniture", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5039, description: "Construction Materials (wholesale)", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5044, description: "Photographic/Copy/Fax Equipment", category: "Equipment", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5045, description: "Computers/Peripherals/Software", category: "Equipment", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5046, description: "Commercial Equipment", category: "Equipment", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5047, description: "Medical/Dental/Ophthalmic Equipment", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 5051, description: "Metal Services/Wire Products", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5065, description: "Electrical Parts/Equipment", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5072, description: "Hardware/Tools (wholesale)", category: "Tools", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5074, description: "Plumbing/Heating (wholesale)", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5085, description: "Industrial Supplies", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },

  // ── Retail - General ──
  { code: 5111, description: "Stationery/Office Supplies", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5131, description: "Piece Goods/Fabrics", category: "Materials", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5137, description: "Uniforms/Commercial Clothing", category: "Workwear", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5139, description: "Commercial Footwear", category: "Workwear", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5169, description: "Chemicals (wholesale)", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5172, description: "Petroleum/Petroleum Products", category: "General Expenses", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5192, description: "Books/Periodicals/Newspapers", category: "Office", vat_type: "Zero", vat_deductible: true },
  { code: 5193, description: "Florists/Nursery Supplies", category: "Materials", vat_type: "Reduced 13.5%", vat_deductible: true },
  { code: 5198, description: "Paints/Varnishes", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5199, description: "Nondurable Goods", category: "Materials", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5200, description: "Home Supply Warehouse", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true, needs_receipt: true },
  { code: 5211, description: "Lumber/Building Materials", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5231, description: "Glass/Paint/Wallpaper", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5251, description: "Hardware Stores", category: "Tools", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5261, description: "Nurseries/Lawn/Garden Supplies", category: "Materials", vat_type: "Reduced 13.5%", vat_deductible: true },

  // ── Retail - General Merchandise ──
  { code: 5300, description: "Wholesale Clubs", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5309, description: "Duty Free Stores", category: "Drawings", vat_type: "Zero", vat_deductible: false },
  { code: 5310, description: "Discount Stores", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5311, description: "Department Stores", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5331, description: "Variety Stores", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },

  // ── Retail - Food / Groceries ──
  { code: 5411, description: "Grocery Stores/Supermarkets", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5422, description: "Freezer/Meat Lockers", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5441, description: "Candy/Confectionery", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5451, description: "Dairy Products", category: "Drawings", vat_type: "Zero", vat_deductible: false },
  { code: 5462, description: "Bakeries", category: "Drawings", vat_type: "Zero", vat_deductible: false },
  { code: 5499, description: "Convenience Stores/Speciality Markets", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },

  // ── Motor Vehicles ──
  { code: 5511, description: "Car/Truck Dealers (New/Used)", category: "Motor Vehicle Expenses", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5521, description: "Car/Truck Dealers (Used)", category: "Motor Vehicle Expenses", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5531, description: "Auto/Home Supply Stores", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5532, description: "Automotive Tyre Stores", category: "Repairs and Maintenance", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5533, description: "Auto Parts/Accessories", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5541, description: "Service Stations (Fuel)", category: "General Expenses", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5542, description: "Automated Fuel Dispensers", category: "General Expenses", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5551, description: "Boat Dealers", category: "Motor Vehicle Expenses", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5571, description: "Motorcycle Dealers", category: "Motor Vehicle Expenses", vat_type: "Standard 23%", vat_deductible: false },

  // ── Clothing / Apparel ──
  { code: 5611, description: "Men's/Boys' Clothing", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5621, description: "Women's Clothing", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5631, description: "Women's Accessories", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5641, description: "Children's/Infants' Clothing", category: "Drawings", vat_type: "Zero", vat_deductible: false },
  { code: 5651, description: "Family Clothing", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5655, description: "Sports/Riding Apparel", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5661, description: "Shoe Stores", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5691, description: "Men's/Women's Clothing", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5699, description: "Clothing/Accessories (misc)", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },

  // ── Home / Furniture ──
  { code: 5712, description: "Furniture/Home Furnishings", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5713, description: "Floor Covering Stores", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5714, description: "Drapery/Window Covering", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5718, description: "Fireplace/Accessories", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 5719, description: "Miscellaneous Home Furnishings", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5722, description: "Household Appliances", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },

  // ── Electronics / Computers ──
  { code: 5732, description: "Electronics Stores", category: "Equipment", vat_type: "Standard 23%", vat_deductible: true, needs_receipt: true },
  { code: 5733, description: "Music Stores/Instruments", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5734, description: "Computer Software Stores", category: "Software", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5735, description: "Record Stores", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },

  // ── Food / Restaurants ──
  { code: 5812, description: "Eating Places/Restaurants", category: "Meals & Entertainment", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5813, description: "Bars/Cocktail Lounges/Pubs", category: "Meals & Entertainment", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5814, description: "Fast Food Restaurants", category: "Meals & Entertainment", vat_type: "Standard 23%", vat_deductible: false },

  // ── Retail - Misc ──
  { code: 5912, description: "Drug Stores/Pharmacies", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 5921, description: "Package Stores (Beer/Wine/Liquor)", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5931, description: "Used Merchandise/Second-Hand", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5941, description: "Sporting Goods", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5942, description: "Book Stores", category: "Office", vat_type: "Zero", vat_deductible: true },
  { code: 5943, description: "Stationery Stores", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 5944, description: "Jewelry Stores/Watches", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5945, description: "Hobby/Toy/Game Shops", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5946, description: "Camera/Photographic Supplies", category: "Equipment", vat_type: "Standard 23%", vat_deductible: true, needs_receipt: true },
  { code: 5947, description: "Gift/Card/Novelty Shops", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5948, description: "Luggage/Leather Goods", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5970, description: "Artist Supply/Craft Stores", category: "Materials", vat_type: "Standard 23%", vat_deductible: true, needs_receipt: true },
  { code: 5971, description: "Art Dealers/Galleries", category: "Drawings", vat_type: "Reduced 13.5%", vat_deductible: false },
  { code: 5972, description: "Stamp/Coin Stores", category: "Drawings", vat_type: "Exempt", vat_deductible: false },
  { code: 5977, description: "Cosmetic Stores", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5983, description: "Fuel Dealers (Non-Automotive)", category: "General Expenses", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 5992, description: "Florists", category: "Drawings", vat_type: "Reduced 13.5%", vat_deductible: false },
  { code: 5993, description: "Cigar Stores/Tobacconists", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5994, description: "Newsagents", category: "Office", vat_type: "Zero", vat_deductible: true },
  { code: 5995, description: "Pet Shops", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 5999, description: "Miscellaneous/Speciality Retail", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },

  // ── Services ──
  { code: 6010, description: "Financial Institutions (Manual Cash)", category: "Bank fees", vat_type: "Exempt", vat_deductible: false },
  { code: 6011, description: "Automated Cash (ATM)", category: "Bank fees", vat_type: "Exempt", vat_deductible: false },
  { code: 6012, description: "Financial Institutions (Merchandise)", category: "Bank fees", vat_type: "Exempt", vat_deductible: false },
  { code: 6051, description: "Non-Financial Institutions (Foreign Currency/Money Orders)", category: "Bank fees", vat_type: "Exempt", vat_deductible: false },
  { code: 6211, description: "Security Brokers/Dealers", category: "other", vat_type: "Exempt", vat_deductible: false },
  { code: 6300, description: "Insurance (general)", category: "Insurance", vat_type: "Exempt", vat_deductible: false },
  { code: 6513, description: "Real Estate Agents/Rentals", category: "Rent", vat_type: "Exempt", vat_deductible: false },

  // ── Professional Services ──
  { code: 7011, description: "Lodging (Hotels/Motels)", category: "Subsistence", vat_type: "Reduced 13.5%", vat_deductible: false },
  { code: 7210, description: "Laundry/Cleaning Services", category: "Cleaning", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7211, description: "Laundry Services", category: "Cleaning", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7216, description: "Dry Cleaners", category: "Cleaning", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7230, description: "Beauty/Barber Shops", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7251, description: "Shoe Repair/Hat Cleaning", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7261, description: "Funeral Services", category: "other", vat_type: "Exempt", vat_deductible: false },
  { code: 7273, description: "Dating/Escort Services", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7276, description: "Tax Preparation Services", category: "Consulting & Accounting", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7277, description: "Counseling Services", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 7278, description: "Buying/Shopping Services", category: "other", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7296, description: "Clothing Rental", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7297, description: "Massage Parlours", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7298, description: "Health Spas", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7299, description: "Miscellaneous Personal Services", category: "other", vat_type: "Standard 23%", vat_deductible: true, needs_receipt: true },

  // ── Business Services ──
  { code: 7311, description: "Advertising Services", category: "Advertising", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7333, description: "Commercial Photography/Graphics", category: "Marketing", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7338, description: "Quick Copy/Reproduction", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7339, description: "Stenographic/Secretarial Services", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7342, description: "Exterminating/Disinfecting", category: "Repairs and Maintenance", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7349, description: "Cleaning/Maintenance/Janitorial", category: "Cleaning", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7361, description: "Employment Agencies/Temp Help", category: "Wages", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7372, description: "Computer Programming/Data Processing", category: "Software", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7375, description: "Information Retrieval Services", category: "Software", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7379, description: "Computer Maintenance/Repair", category: "Repairs and Maintenance", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7392, description: "Management/Consulting Services", category: "Consulting & Accounting", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7393, description: "Detective/Protective/Security", category: "General Expenses", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7394, description: "Equipment Rental/Leasing", category: "Equipment", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7395, description: "Photo Developing", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7399, description: "Business Services (miscellaneous)", category: "other", vat_type: "Standard 23%", vat_deductible: true, needs_receipt: true },

  // ── Automotive Services ──
  { code: 7511, description: "Truck Stop", category: "General Expenses", vat_type: "Standard 23%", vat_deductible: false, needs_receipt: true },
  { code: 7523, description: "Parking Lots/Garages", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7531, description: "Automotive Body Repair", category: "Repairs and Maintenance", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7534, description: "Tire Retreading/Repair", category: "Repairs and Maintenance", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7535, description: "Automotive Paint Shops", category: "Repairs and Maintenance", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7538, description: "Automotive Service Shops", category: "Repairs and Maintenance", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7542, description: "Car Washes", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },
  { code: 7549, description: "Towing Services", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },

  // ── Entertainment / Recreation ──
  { code: 7801, description: "Government Licensed Online Casinos", category: "Drawings", vat_type: "Exempt", vat_deductible: false },
  { code: 7802, description: "Government Licensed Horse/Dog Racing", category: "Drawings", vat_type: "Exempt", vat_deductible: false },
  { code: 7829, description: "Motion Picture/Video Distribution", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7832, description: "Motion Picture Theatres", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7841, description: "Video Tape Rental", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7911, description: "Dance Halls/Studios/Schools", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7922, description: "Theatrical Producers", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7929, description: "Bands/Orchestras/Entertainers", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7932, description: "Billiard/Pool Establishments", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7933, description: "Bowling Alleys", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7941, description: "Sports Clubs/Fields", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7991, description: "Tourist Attractions/Exhibits", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7992, description: "Golf Courses", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7993, description: "Video Amusement Game", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7994, description: "Video Game Arcades", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7995, description: "Betting (including Lottery)", category: "Drawings", vat_type: "Exempt", vat_deductible: false },
  { code: 7996, description: "Amusement Parks/Carnivals", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7997, description: "Membership Clubs (Country/Athletic)", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7998, description: "Aquariums/Seaquariums", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },
  { code: 7999, description: "Recreation Services", category: "Drawings", vat_type: "Standard 23%", vat_deductible: false },

  // ── Professional Services ──
  { code: 8011, description: "Doctors (not elsewhere classified)", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8021, description: "Dentists/Orthodontists", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8031, description: "Osteopaths", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8041, description: "Chiropractors", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8042, description: "Optometrists/Ophthalmologists", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8043, description: "Opticians/Optical Goods", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8049, description: "Podiatrists/Chiropodists", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8050, description: "Nursing/Personal Care Facilities", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8062, description: "Hospitals", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8071, description: "Medical/Dental Labs", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8099, description: "Medical Services (misc)", category: "Medical", vat_type: "Exempt", vat_deductible: false, relief_type: "medical" },
  { code: 8111, description: "Legal Services", category: "Consulting & Accounting", vat_type: "Standard 23%", vat_deductible: true },
  { code: 8211, description: "Schools (Elementary/Secondary)", category: "other", vat_type: "Exempt", vat_deductible: false, relief_type: "tuition" },
  { code: 8220, description: "Colleges/Universities", category: "other", vat_type: "Exempt", vat_deductible: false, relief_type: "tuition" },
  { code: 8241, description: "Correspondence Schools", category: "Training", vat_type: "Exempt", vat_deductible: false },
  { code: 8244, description: "Business/Secretarial Schools", category: "Training", vat_type: "Exempt", vat_deductible: false },
  { code: 8249, description: "Vocational/Trade Schools", category: "Training", vat_type: "Standard 23%", vat_deductible: true, isTradeSupplier: true },
  { code: 8299, description: "Schools/Educational Services (misc)", category: "Training", vat_type: "Exempt", vat_deductible: false },
  { code: 8351, description: "Child Care Services", category: "Drawings", vat_type: "Exempt", vat_deductible: false },
  { code: 8398, description: "Charitable/Social Service Organizations", category: "other", vat_type: "Exempt", vat_deductible: false, relief_type: "charitable" },
  { code: 8641, description: "Civic/Social/Fraternal Associations", category: "other", vat_type: "Exempt", vat_deductible: false },
  { code: 8651, description: "Political Organizations", category: "other", vat_type: "Exempt", vat_deductible: false },
  { code: 8661, description: "Religious Organizations", category: "other", vat_type: "Exempt", vat_deductible: false },
  { code: 8675, description: "Automobile Associations", category: "Motor/travel", vat_type: "Standard 23%", vat_deductible: true },
  { code: 8699, description: "Membership Organizations", category: "Consulting & Accounting", vat_type: "Exempt", vat_deductible: false },
  { code: 8734, description: "Testing Laboratories", category: "Consulting & Accounting", vat_type: "Standard 23%", vat_deductible: true },
  { code: 8911, description: "Architectural/Engineering Services", category: "Consulting & Accounting", vat_type: "Standard 23%", vat_deductible: true },
  { code: 8931, description: "Accounting/Auditing/Bookkeeping", category: "Consulting & Accounting", vat_type: "Standard 23%", vat_deductible: true },
  { code: 8999, description: "Professional Services (misc)", category: "Consulting & Accounting", vat_type: "Standard 23%", vat_deductible: true },

  // ── Government Services ──
  { code: 9211, description: "Court Costs", category: "Consulting & Accounting", vat_type: "Exempt", vat_deductible: false },
  { code: 9222, description: "Fines", category: "other", vat_type: "Exempt", vat_deductible: false },
  { code: 9223, description: "Bail/Bond Payments", category: "other", vat_type: "Exempt", vat_deductible: false },
  { code: 9311, description: "Tax Payments", category: "other", vat_type: "Exempt", vat_deductible: false },
  { code: 9399, description: "Government Services (misc)", category: "Consulting & Accounting", vat_type: "Exempt", vat_deductible: false },
  { code: 9402, description: "Postal Services (Government)", category: "Office", vat_type: "Standard 23%", vat_deductible: true },
  { code: 9405, description: "Intra-Government Purchases", category: "other", vat_type: "Exempt", vat_deductible: false },
];

// Build a fast lookup map (code → MCCMapping)
const mccLookupMap = new Map<number, MCCMapping>();
for (const m of mccMappings) {
  mccLookupMap.set(m.code, m);
}

/** Look up a single MCC code. Returns undefined if not found. */
export function lookupMCC(code: number): MCCMapping | undefined {
  return mccLookupMap.get(code);
}

/** Look up MCC code with fallback to nearest category range. */
export function lookupMCCWithFallback(code: number): MCCMapping | undefined {
  // Exact match first
  const exact = mccLookupMap.get(code);
  if (exact) return exact;

  // Airline range 3000-3350
  if (code >= 3000 && code <= 3350) return mccLookupMap.get(3000);
  // Car rental range 3351-3500
  if (code >= 3351 && code <= 3500) return mccLookupMap.get(3351);
  // Hotel range 3501-3999
  if (code >= 3501 && code <= 3999) return mccLookupMap.get(3501);

  return undefined;
}
