const ESPN_SCHOOL_IDS: Record<string, number> = {
  Alabama: 333, "App State": 2026, "Appalachian State": 2026, Arizona: 12,
  "Arizona State": 9, Arkansas: 8, "Arkansas State": 240, Army: 349, Auburn: 2,
  Baylor: 239, "Boise State": 68, "Boston College": 103, Buffalo: 2084, BYU: 252,
  California: 25, Charlotte: 2429, Cincinnati: 2132, Clemson: 228,
  "Coastal Carolina": 324, Colorado: 38, "Colorado State": 36, Connecticut: 41,
  UConn: 41, Duke: 150, "East Carolina": 151, FIU: 2229, Florida: 57,
  "Florida Atlantic": 2226, "Florida State": 52, "Fresno State": 278, Georgia: 61,
  "Georgia State": 2247, "Georgia Tech": 59, Hawaii: 62, Houston: 248, Illinois: 356,
  Indiana: 84, Iowa: 2294, "Iowa State": 66, Kansas: 2305, "Kansas State": 2306,
  "Kent State": 2309, Kentucky: 96, Liberty: 2335, Louisiana: 309,
  "Louisiana Lafayette": 309, "Louisiana Monroe": 2433, "Louisiana Tech": 2348,
  Louisville: 97, LSU: 99, Marshall: 276, Maryland: 120, Memphis: 235, Miami: 2390,
  "Miami (FL)": 2390, "Miami (OH)": 193, Michigan: 130, "Michigan State": 127,
  "Middle Tennessee": 2393, Minnesota: 135, "Mississippi State": 344, Missouri: 142,
  Navy: 2426, Nebraska: 158, Nevada: 2440, "New Mexico": 167, "New Mexico State": 2443,
  "North Carolina": 153, UNC: 153, "NC State": 152, "North Texas": 249,
  "Northern Illinois": 2459, Northwestern: 77, "Notre Dame": 87, Ohio: 2465,
  "Ohio State": 194, Oklahoma: 201, "Oklahoma State": 197, "Ole Miss": 145,
  Oregon: 2483, "Oregon State": 204, "Penn State": 213, Pittsburgh: 221, Pitt: 221,
  Purdue: 2509, Rice: 242, Rutgers: 164, "San Diego State": 21, "San Jose State": 23,
  SMU: 2567, "South Alabama": 6, "South Carolina": 2579, "South Florida": 58, USF: 58,
  "Southern Miss": 2572, Stanford: 24, Syracuse: 183, TCU: 2628, Temple: 218,
  Tennessee: 2633, Texas: 251, "Texas A&M": 245, "Texas State": 2627,
  "Texas Tech": 2641, Toledo: 2657, Troy: 2653, Tulane: 2655, Tulsa: 202, UAB: 5765,
  UCLA: 26, UCF: 2116, UNLV: 2439, USC: 30, Utah: 254, "Utah State": 328, UTEP: 2638,
  UTSA: 2636, Vanderbilt: 238, Virginia: 258, UVA: 258, "Virginia Tech": 259,
  "Wake Forest": 154, Washington: 264, "Washington State": 265, "West Virginia": 277,
  "Western Kentucky": 98, Wisconsin: 275, Wyoming: 2751,
};
export function getSchoolLogoUrl(school: string | null | undefined): string | null {
  if (!school) return null;
  const id = ESPN_SCHOOL_IDS[school];
  if (!id) return null;
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
}
