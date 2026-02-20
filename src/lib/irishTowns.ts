export interface IrishTown {
  name: string;
  county: string;
  distanceFromDublin: number;
}

/**
 * Comprehensive Irish towns dataset covering all 26 counties.
 * Distance values are approximate road km from Dublin city centre.
 */
export const IRISH_TOWNS: IrishTown[] = [
  // Dublin (0 km)
  { name: "Dublin", county: "Dublin", distanceFromDublin: 0 },
  { name: "Swords", county: "Dublin", distanceFromDublin: 17 },
  { name: "Blanchardstown", county: "Dublin", distanceFromDublin: 12 },
  { name: "Tallaght", county: "Dublin", distanceFromDublin: 15 },
  { name: "Lucan", county: "Dublin", distanceFromDublin: 13 },
  { name: "Clondalkin", county: "Dublin", distanceFromDublin: 12 },
  { name: "Finglas", county: "Dublin", distanceFromDublin: 8 },
  { name: "Malahide", county: "Dublin", distanceFromDublin: 17 },
  { name: "Howth", county: "Dublin", distanceFromDublin: 16 },
  { name: "Dun Laoghaire", county: "Dublin", distanceFromDublin: 12 },
  { name: "Dundrum", county: "Dublin", distanceFromDublin: 8 },
  { name: "Balbriggan", county: "Dublin", distanceFromDublin: 35 },
  { name: "Skerries", county: "Dublin", distanceFromDublin: 30 },
  { name: "Rush", county: "Dublin", distanceFromDublin: 27 },
  { name: "Donabate", county: "Dublin", distanceFromDublin: 22 },
  { name: "Rathfarnham", county: "Dublin", distanceFromDublin: 7 },
  { name: "Castleknock", county: "Dublin", distanceFromDublin: 10 },
  { name: "Raheny", county: "Dublin", distanceFromDublin: 7 },
  { name: "Clontarf", county: "Dublin", distanceFromDublin: 5 },
  { name: "Blackrock", county: "Dublin", distanceFromDublin: 9 },
  { name: "Stillorgan", county: "Dublin", distanceFromDublin: 10 },
  { name: "Santry", county: "Dublin", distanceFromDublin: 7 },
  { name: "Lusk", county: "Dublin", distanceFromDublin: 25 },
  { name: "Tyrrelstown", county: "Dublin", distanceFromDublin: 14 },

  // Cork (260 km)
  { name: "Cork", county: "Cork", distanceFromDublin: 260 },
  { name: "Cobh", county: "Cork", distanceFromDublin: 275 },
  { name: "Midleton", county: "Cork", distanceFromDublin: 265 },
  { name: "Mallow", county: "Cork", distanceFromDublin: 240 },
  { name: "Youghal", county: "Cork", distanceFromDublin: 250 },
  { name: "Bantry", county: "Cork", distanceFromDublin: 340 },
  { name: "Fermoy", county: "Cork", distanceFromDublin: 230 },
  { name: "Douglas", county: "Cork", distanceFromDublin: 262 },
  { name: "Ballincollig", county: "Cork", distanceFromDublin: 265 },
  { name: "Carrigaline", county: "Cork", distanceFromDublin: 270 },
  { name: "Kinsale", county: "Cork", distanceFromDublin: 285 },
  { name: "Bandon", county: "Cork", distanceFromDublin: 290 },
  { name: "Macroom", county: "Cork", distanceFromDublin: 290 },
  { name: "Clonakilty", county: "Cork", distanceFromDublin: 315 },
  { name: "Skibbereen", county: "Cork", distanceFromDublin: 330 },
  { name: "Charleville", county: "Cork", distanceFromDublin: 215 },
  { name: "Kanturk", county: "Cork", distanceFromDublin: 260 },

  // Galway (210 km)
  { name: "Galway", county: "Galway", distanceFromDublin: 210 },
  { name: "Tuam", county: "Galway", distanceFromDublin: 225 },
  { name: "Loughrea", county: "Galway", distanceFromDublin: 190 },
  { name: "Ballinasloe", county: "Galway", distanceFromDublin: 160 },
  { name: "Clifden", county: "Galway", distanceFromDublin: 295 },
  { name: "Oranmore", county: "Galway", distanceFromDublin: 205 },
  { name: "Athenry", county: "Galway", distanceFromDublin: 200 },
  { name: "Gort", county: "Galway", distanceFromDublin: 200 },
  { name: "Portumna", county: "Galway", distanceFromDublin: 165 },

  // Limerick (200 km)
  { name: "Limerick", county: "Limerick", distanceFromDublin: 200 },
  { name: "Newcastle West", county: "Limerick", distanceFromDublin: 235 },
  { name: "Adare", county: "Limerick", distanceFromDublin: 215 },
  { name: "Kilmallock", county: "Limerick", distanceFromDublin: 210 },
  { name: "Abbeyfeale", county: "Limerick", distanceFromDublin: 260 },

  // Waterford (165 km)
  { name: "Waterford", county: "Waterford", distanceFromDublin: 165 },
  { name: "Dungarvan", county: "Waterford", distanceFromDublin: 200 },
  { name: "Tramore", county: "Waterford", distanceFromDublin: 175 },
  { name: "Lismore", county: "Waterford", distanceFromDublin: 215 },

  // Kilkenny (130 km)
  { name: "Kilkenny", county: "Kilkenny", distanceFromDublin: 130 },
  { name: "Callan", county: "Kilkenny", distanceFromDublin: 140 },
  { name: "Thomastown", county: "Kilkenny", distanceFromDublin: 140 },
  { name: "Castlecomer", county: "Kilkenny", distanceFromDublin: 115 },

  // Wexford (150 km)
  { name: "Wexford", county: "Wexford", distanceFromDublin: 150 },
  { name: "Gorey", county: "Wexford", distanceFromDublin: 100 },
  { name: "Enniscorthy", county: "Wexford", distanceFromDublin: 130 },
  { name: "New Ross", county: "Wexford", distanceFromDublin: 150 },
  { name: "Bunclody", county: "Wexford", distanceFromDublin: 115 },

  // Wicklow (55 km)
  { name: "Wicklow", county: "Wicklow", distanceFromDublin: 55 },
  { name: "Arklow", county: "Wicklow", distanceFromDublin: 75 },
  { name: "Bray", county: "Wicklow", distanceFromDublin: 22 },
  { name: "Greystones", county: "Wicklow", distanceFromDublin: 28 },
  { name: "Blessington", county: "Wicklow", distanceFromDublin: 35 },
  { name: "Rathdrum", county: "Wicklow", distanceFromDublin: 60 },
  { name: "Baltinglass", county: "Wicklow", distanceFromDublin: 65 },

  // Kildare (50 km)
  { name: "Naas", county: "Kildare", distanceFromDublin: 32 },
  { name: "Newbridge", county: "Kildare", distanceFromDublin: 48 },
  { name: "Celbridge", county: "Kildare", distanceFromDublin: 22 },
  { name: "Leixlip", county: "Kildare", distanceFromDublin: 18 },
  { name: "Maynooth", county: "Kildare", distanceFromDublin: 25 },
  { name: "Athy", county: "Kildare", distanceFromDublin: 78 },
  { name: "Kildare", county: "Kildare", distanceFromDublin: 55 },
  { name: "Clane", county: "Kildare", distanceFromDublin: 30 },
  { name: "Kilcock", county: "Kildare", distanceFromDublin: 28 },
  { name: "Monasterevin", county: "Kildare", distanceFromDublin: 65 },
  { name: "Sallins", county: "Kildare", distanceFromDublin: 33 },
  { name: "Prosperous", county: "Kildare", distanceFromDublin: 38 },

  // Meath (50 km)
  { name: "Navan", county: "Meath", distanceFromDublin: 50 },
  { name: "Trim", county: "Meath", distanceFromDublin: 55 },
  { name: "Kells", county: "Meath", distanceFromDublin: 65 },
  { name: "Ashbourne", county: "Meath", distanceFromDublin: 20 },
  { name: "Dunboyne", county: "Meath", distanceFromDublin: 18 },
  { name: "Dunshaughlin", county: "Meath", distanceFromDublin: 30 },
  { name: "Enfield", county: "Meath", distanceFromDublin: 40 },
  { name: "Ratoath", county: "Meath", distanceFromDublin: 22 },
  { name: "Bettystown", county: "Meath", distanceFromDublin: 42 },
  { name: "Laytown", county: "Meath", distanceFromDublin: 45 },

  // Louth (80 km)
  { name: "Drogheda", county: "Louth", distanceFromDublin: 50 },
  { name: "Dundalk", county: "Louth", distanceFromDublin: 85 },
  { name: "Ardee", county: "Louth", distanceFromDublin: 70 },
  { name: "Carlingford", county: "Louth", distanceFromDublin: 100 },
  { name: "Dunleer", county: "Louth", distanceFromDublin: 60 },

  // Westmeath (100 km)
  { name: "Mullingar", county: "Westmeath", distanceFromDublin: 80 },
  { name: "Athlone", county: "Westmeath", distanceFromDublin: 130 },
  { name: "Moate", county: "Westmeath", distanceFromDublin: 115 },
  { name: "Kilbeggan", county: "Westmeath", distanceFromDublin: 95 },
  { name: "Castlepollard", county: "Westmeath", distanceFromDublin: 95 },

  // Offaly (110 km)
  { name: "Tullamore", county: "Offaly", distanceFromDublin: 105 },
  { name: "Birr", county: "Offaly", distanceFromDublin: 140 },
  { name: "Edenderry", county: "Offaly", distanceFromDublin: 60 },
  { name: "Clara", county: "Offaly", distanceFromDublin: 110 },
  { name: "Banagher", county: "Offaly", distanceFromDublin: 145 },

  // Laois (100 km)
  { name: "Portlaoise", county: "Laois", distanceFromDublin: 90 },
  { name: "Mountmellick", county: "Laois", distanceFromDublin: 85 },
  { name: "Portarlington", county: "Laois", distanceFromDublin: 75 },
  { name: "Mountrath", county: "Laois", distanceFromDublin: 105 },
  { name: "Abbeyleix", county: "Laois", distanceFromDublin: 110 },
  { name: "Rathdowney", county: "Laois", distanceFromDublin: 120 },
  { name: "Stradbally", county: "Laois", distanceFromDublin: 95 },

  // Longford (130 km)
  { name: "Longford", county: "Longford", distanceFromDublin: 125 },
  { name: "Ballymahon", county: "Longford", distanceFromDublin: 130 },
  { name: "Granard", county: "Longford", distanceFromDublin: 115 },
  { name: "Edgeworthstown", county: "Longford", distanceFromDublin: 115 },

  // Tipperary (175 km)
  { name: "Clonmel", county: "Tipperary", distanceFromDublin: 170 },
  { name: "Thurles", county: "Tipperary", distanceFromDublin: 145 },
  { name: "Nenagh", county: "Tipperary", distanceFromDublin: 160 },
  { name: "Tipperary", county: "Tipperary", distanceFromDublin: 190 },
  { name: "Cahir", county: "Tipperary", distanceFromDublin: 185 },
  { name: "Cashel", county: "Tipperary", distanceFromDublin: 165 },
  { name: "Roscrea", county: "Tipperary", distanceFromDublin: 130 },
  { name: "Carrick-on-Suir", county: "Tipperary", distanceFromDublin: 170 },
  { name: "Templemore", county: "Tipperary", distanceFromDublin: 140 },

  // Kerry (305 km)
  { name: "Tralee", county: "Kerry", distanceFromDublin: 305 },
  { name: "Killarney", county: "Kerry", distanceFromDublin: 310 },
  { name: "Kenmare", county: "Kerry", distanceFromDublin: 340 },
  { name: "Dingle", county: "Kerry", distanceFromDublin: 350 },
  { name: "Listowel", county: "Kerry", distanceFromDublin: 285 },
  { name: "Cahersiveen", county: "Kerry", distanceFromDublin: 355 },
  { name: "Killorglin", county: "Kerry", distanceFromDublin: 320 },
  { name: "Castleisland", county: "Kerry", distanceFromDublin: 290 },

  // Clare (230 km)
  { name: "Ennis", county: "Clare", distanceFromDublin: 230 },
  { name: "Shannon", county: "Clare", distanceFromDublin: 220 },
  { name: "Kilrush", county: "Clare", distanceFromDublin: 270 },
  { name: "Killaloe", county: "Clare", distanceFromDublin: 170 },
  { name: "Ennistymon", county: "Clare", distanceFromDublin: 260 },
  { name: "Scarriff", county: "Clare", distanceFromDublin: 185 },

  // Sligo (215 km)
  { name: "Sligo", county: "Sligo", distanceFromDublin: 215 },
  { name: "Ballymote", county: "Sligo", distanceFromDublin: 230 },
  { name: "Tobercurry", county: "Sligo", distanceFromDublin: 240 },
  { name: "Enniscrone", county: "Sligo", distanceFromDublin: 255 },
  { name: "Strandhill", county: "Sligo", distanceFromDublin: 220 },

  // Donegal (275 km)
  { name: "Letterkenny", county: "Donegal", distanceFromDublin: 240 },
  { name: "Donegal", county: "Donegal", distanceFromDublin: 265 },
  { name: "Bundoran", county: "Donegal", distanceFromDublin: 255 },
  { name: "Buncrana", county: "Donegal", distanceFromDublin: 270 },
  { name: "Ballyshannon", county: "Donegal", distanceFromDublin: 255 },
  { name: "Carndonagh", county: "Donegal", distanceFromDublin: 290 },
  { name: "Dunfanaghy", county: "Donegal", distanceFromDublin: 285 },
  { name: "Killybegs", county: "Donegal", distanceFromDublin: 290 },

  // Mayo (280 km)
  { name: "Castlebar", county: "Mayo", distanceFromDublin: 265 },
  { name: "Westport", county: "Mayo", distanceFromDublin: 260 },
  { name: "Ballina", county: "Mayo", distanceFromDublin: 250 },
  { name: "Belmullet", county: "Mayo", distanceFromDublin: 320 },
  { name: "Ballinrobe", county: "Mayo", distanceFromDublin: 240 },
  { name: "Claremorris", county: "Mayo", distanceFromDublin: 235 },
  { name: "Swinford", county: "Mayo", distanceFromDublin: 245 },
  { name: "Knock", county: "Mayo", distanceFromDublin: 235 },
  { name: "Foxford", county: "Mayo", distanceFromDublin: 250 },

  // Roscommon (190 km)
  { name: "Roscommon", county: "Roscommon", distanceFromDublin: 160 },
  { name: "Boyle", county: "Roscommon", distanceFromDublin: 195 },
  { name: "Castlerea", county: "Roscommon", distanceFromDublin: 195 },
  { name: "Strokestown", county: "Roscommon", distanceFromDublin: 165 },
  { name: "Ballaghaderreen", county: "Roscommon", distanceFromDublin: 210 },

  // Leitrim (235 km)
  { name: "Carrick-on-Shannon", county: "Leitrim", distanceFromDublin: 160 },
  { name: "Manorhamilton", county: "Leitrim", distanceFromDublin: 220 },
  { name: "Mohill", county: "Leitrim", distanceFromDublin: 155 },
  { name: "Drumshanbo", county: "Leitrim", distanceFromDublin: 170 },
  { name: "Ballinamore", county: "Leitrim", distanceFromDublin: 165 },

  // Cavan (130 km)
  { name: "Cavan", county: "Cavan", distanceFromDublin: 115 },
  { name: "Virginia", county: "Cavan", distanceFromDublin: 90 },
  { name: "Bailieborough", county: "Cavan", distanceFromDublin: 100 },
  { name: "Kingscourt", county: "Cavan", distanceFromDublin: 85 },
  { name: "Ballyconnell", county: "Cavan", distanceFromDublin: 145 },
  { name: "Cootehill", county: "Cavan", distanceFromDublin: 120 },
  { name: "Belturbet", county: "Cavan", distanceFromDublin: 140 },

  // Monaghan (130 km)
  { name: "Monaghan", county: "Monaghan", distanceFromDublin: 130 },
  { name: "Carrickmacross", county: "Monaghan", distanceFromDublin: 95 },
  { name: "Castleblayney", county: "Monaghan", distanceFromDublin: 105 },
  { name: "Clones", county: "Monaghan", distanceFromDublin: 150 },
  { name: "Ballybay", county: "Monaghan", distanceFromDublin: 120 },

  // Carlow (85 km)
  { name: "Carlow", county: "Carlow", distanceFromDublin: 85 },
  { name: "Tullow", county: "Carlow", distanceFromDublin: 90 },
  { name: "Muine Bheag", county: "Carlow", distanceFromDublin: 100 },
  { name: "Borris", county: "Carlow", distanceFromDublin: 110 },
  { name: "Hacketstown", county: "Carlow", distanceFromDublin: 80 },
];

/** Format a town for display and storage: "Town, Co. County" */
export function formatTownDisplay(town: IrishTown): string {
  return `${town.name}, Co. ${town.county}`;
}
