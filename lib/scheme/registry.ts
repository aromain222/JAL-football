export interface SchemeProfile {
  offense_family: "spread" | "pro" | "air_raid" | "option" | "west_coast" | "pistol";
  run_family: "zone" | "gap" | "power" | "read_option" | "triple_option" | "balanced";
  offense_style: "pass_heavy" | "run_heavy" | "balanced" | "tempo" | "RPO_heavy";
  defense_front: "4-2-5" | "3-4" | "4-3" | "3-3-5" | "multiple";
  defense_style: "zone" | "man" | "press_man" | "cover_2" | "zone_pressure" | "man_pressure" | "multiple";
}

// ---------------------------------------------------------------------------
// Canonical school name → scheme profile
// All keys are lowercase normalized.
// ---------------------------------------------------------------------------
export const SCHOOL_SCHEMES: Record<string, SchemeProfile> = {
  // ── ACC ──────────────────────────────────────────────────────────────────
  "clemson":             { offense_family: "pro",      run_family: "gap",        offense_style: "balanced",   defense_front: "4-3",   defense_style: "man_pressure" },
  "florida state":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "multiple" },
  "miami":               { offense_family: "pro",      run_family: "gap",        offense_style: "balanced",   defense_front: "4-3",   defense_style: "man_pressure" },
  "nc state":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "north carolina":      { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "duke":                { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "wake forest":         { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone_pressure" },
  "boston college":      { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "virginia tech":       { offense_family: "spread",   run_family: "read_option",offense_style: "RPO_heavy",  defense_front: "4-2-5", defense_style: "zone_pressure" },
  "virginia":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "georgia tech":        { offense_family: "option",   run_family: "triple_option",offense_style: "run_heavy", defense_front: "3-4",  defense_style: "zone" },
  "pitt":                { offense_family: "pro",      run_family: "gap",        offense_style: "balanced",   defense_front: "3-3-5", defense_style: "zone_pressure" },
  "louisville":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "syracuse":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "stanford":            { offense_family: "pro",      run_family: "power",      offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "cal":                 { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "california":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "smu":                 { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "man_pressure" },

  // ── Big Ten ───────────────────────────────────────────────────────────────
  "ohio state":          { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "man_pressure" },
  "michigan":            { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "michigan state":      { offense_family: "pro",      run_family: "power",      offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "penn state":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "iowa":                { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "wisconsin":           { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "minnesota":           { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "nebraska":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "illinois":            { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "indiana":             { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "purdue":              { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "northwestern":        { offense_family: "west_coast",run_family: "zone",      offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "rutgers":             { offense_family: "pro",      run_family: "gap",        offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone_pressure" },
  "maryland":            { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "ucla":                { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "usc":                 { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "man_pressure" },
  "washington":          { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone_pressure" },
  "oregon":              { offense_family: "spread",   run_family: "zone",       offense_style: "tempo",      defense_front: "3-4",   defense_style: "zone_pressure" },
  "penn st":             { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },

  // ── SEC ───────────────────────────────────────────────────────────────────
  "alabama":             { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "3-4",   defense_style: "man_pressure" },
  "georgia":             { offense_family: "pro",      run_family: "power",      offense_style: "balanced",   defense_front: "3-4",   defense_style: "man_pressure" },
  "lsu":                 { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "man_pressure" },
  "florida":             { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "tennessee":           { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone_pressure" },
  "auburn":              { offense_family: "spread",   run_family: "gap",        offense_style: "balanced",   defense_front: "4-3",   defense_style: "multiple" },
  "texas a&m":           { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "man_pressure" },
  "mississippi state":   { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-3",   defense_style: "zone" },
  "ole miss":            { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone_pressure" },
  "arkansas":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "south carolina":      { offense_family: "pro",      run_family: "gap",        offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "kentucky":            { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "vanderbilt":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "missouri":            { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone_pressure" },
  "oklahoma":            { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "multiple" },
  "texas":               { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "multiple" },

  // ── Big 12 ────────────────────────────────────────────────────────────────
  "kansas state":        { offense_family: "spread",   run_family: "read_option",offense_style: "RPO_heavy",  defense_front: "4-2-5", defense_style: "zone_pressure" },
  "iowa state":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "baylor":              { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "tcu":                 { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "texas tech":          { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "multiple" },
  "west virginia":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "oklahoma state":      { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "multiple" },
  "kansas":              { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "colorado":            { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "multiple" },
  "utah":                { offense_family: "pro",      run_family: "zone",       offense_style: "balanced",   defense_front: "3-4",   defense_style: "zone_pressure" },
  "arizona state":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "arizona":             { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "byu":                 { offense_family: "pro",      run_family: "power",      offense_style: "balanced",   defense_front: "3-4",   defense_style: "zone" },
  "houston":             { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "multiple" },
  "cincinnati":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "ucf":                 { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "multiple" },

  // ── AAC ───────────────────────────────────────────────────────────────────
  "tulane":              { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "memphis":             { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "navy":                { offense_family: "option",   run_family: "triple_option",offense_style: "run_heavy", defense_front: "3-4",  defense_style: "zone" },
  "army":                { offense_family: "option",   run_family: "triple_option",offense_style: "run_heavy", defense_front: "3-4",  defense_style: "zone" },
  "tulsa":               { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "usf":                 { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "south florida":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "temple":              { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "east carolina":       { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "charlotte":           { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "rice":                { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "north texas":         { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "utsa":                { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "florida atlantic":    { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },

  // ── Mountain West ─────────────────────────────────────────────────────────
  "boise state":         { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "fresno state":        { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "sdsu":                { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "san diego state":     { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "air force":           { offense_family: "option",   run_family: "triple_option",offense_style: "run_heavy", defense_front: "3-4",  defense_style: "zone" },
  "nevada":              { offense_family: "pistol",   run_family: "read_option",offense_style: "RPO_heavy",  defense_front: "4-2-5", defense_style: "zone" },
  "unlv":                { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "new mexico":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "wyoming":             { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "colorado state":      { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "utah state":          { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone_pressure" },
  "hawaii":              { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "san jose state":      { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },

  // ── Sun Belt ──────────────────────────────────────────────────────────────
  "appalachian state":   { offense_family: "spread",   run_family: "read_option",offense_style: "RPO_heavy",  defense_front: "3-3-5", defense_style: "zone_pressure" },
  "georgia southern":    { offense_family: "option",   run_family: "read_option",offense_style: "run_heavy",  defense_front: "3-4",   defense_style: "zone" },
  "georgia state":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "troy":                { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "south alabama":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "louisiana":           { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "3-4",   defense_style: "zone" },
  "ul monroe":           { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "arkansas state":      { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "old dominion":        { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "marshall":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "james madison":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "coastal carolina":    { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },

  // ── MAC ───────────────────────────────────────────────────────────────────
  "ohio":                { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "miami oh":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "miami (oh)":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "toledo":              { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "bowling green":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "ball state":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "western michigan":    { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "central michigan":    { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "eastern michigan":    { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "northern illinois":   { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "kent state":          { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "akron":               { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "buffalo":             { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "massachusetts":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },

  // ── CUSA ──────────────────────────────────────────────────────────────────
  "liberty":             { offense_family: "spread",   run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "jacksonville state":  { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "sam houston":         { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "western kentucky":    { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "utep":                { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "florida international": { offense_family: "spread", run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "louisiana tech":      { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "new mexico state":    { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "kennesaw state":      { offense_family: "option",   run_family: "read_option",offense_style: "run_heavy",  defense_front: "3-3-5", defense_style: "zone" },
  "uab":                 { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "3-3-5", defense_style: "zone_pressure" },
  "middle tennessee":    { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "norfolk state":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "campbell":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },

  // ── Top FCS / Ivy / HBCU ─────────────────────────────────────────────────
  "north dakota state":  { offense_family: "pro",      run_family: "power",      offense_style: "run_heavy",  defense_front: "4-3",   defense_style: "zone" },
  "south dakota state":  { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "montana":             { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "villanova":           { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "yale":                { offense_family: "pro",      run_family: "power",      offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "harvard":             { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "princeton":           { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "columbia":            { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "jackson state":       { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone_pressure" },
  "florida a&m":         { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "grambling":           { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "howard":              { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "uconn":               { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-2-5", defense_style: "zone" },
  "fordham":             { offense_family: "spread",   run_family: "zone",       offense_style: "balanced",   defense_front: "4-3",   defense_style: "zone" },
  "notre dame":          { offense_family: "pro",      run_family: "power",      offense_style: "balanced",   defense_front: "4-3",   defense_style: "multiple" },
  "washington state":    { offense_family: "air_raid", run_family: "zone",       offense_style: "pass_heavy", defense_front: "4-2-5", defense_style: "zone" },
  "florida state seminoles": { offense_family: "spread", run_family: "zone",     offense_style: "balanced",   defense_front: "4-3",   defense_style: "multiple" },
};

// ---------------------------------------------------------------------------
// Alias map — stored name variants → canonical key
// ---------------------------------------------------------------------------
export const SCHOOL_ALIASES: Record<string, string> = {
  // Abbreviations / short forms
  "w kentucky":              "western kentucky",
  "w. kentucky":             "western kentucky",
  "wku":                     "western kentucky",
  "ball st":                 "ball state",
  "ball st.":                "ball state",
  "georgia st":              "georgia state",
  "georgia st.":             "georgia state",
  "la monroe":               "ul monroe",
  "ul-monroe":               "ul monroe",
  "louisiana monroe":        "ul monroe",
  "ull":                     "louisiana",
  "louisiana lafayette":     "louisiana",
  "fau":                     "florida atlantic",
  "fiu":                     "florida international",
  "famu":                    "florida a&m",
  "fla. a&m":                "florida a&m",
  "ole miss":                "ole miss",
  "miss. state":             "mississippi state",
  "miss state":              "mississippi state",
  "msstate":                 "mississippi state",
  "nc st":                   "nc state",
  "nc st.":                  "nc state",
  "n.c. state":              "nc state",
  "north carolina state":    "nc state",
  "s. carolina":             "south carolina",
  "s carolina":              "south carolina",
  "ohio st":                 "ohio state",
  "ohio st.":                "ohio state",
  "tcu":                     "tcu",
  "texas christian":         "tcu",
  "penn st":                 "penn state",
  "penn st.":                "penn state",
  "mich state":              "michigan state",
  "mich st":                 "michigan state",
  "mich. state":             "michigan state",
  "tx a&m":                  "texas a&m",
  "tamu":                    "texas a&m",
  "virginia tech":           "virginia tech",
  "vt":                      "virginia tech",
  "va tech":                 "virginia tech",
  "app state":               "appalachian state",
  "appalachian st":          "appalachian state",
  "ga southern":             "georgia southern",
  "ga. southern":            "georgia southern",
  "kent st":                 "kent state",
  "kent st.":                "kent state",
  "e. michigan":             "eastern michigan",
  "emu":                     "eastern michigan",
  "c. michigan":             "central michigan",
  "w. michigan":             "western michigan",
  "n. illinois":             "northern illinois",
  "niu":                     "northern illinois",
  "wmu":                     "western michigan",
  "ndsu":                    "north dakota state",
  "sdsu":                    "san diego state",
  "sdsu (fcs)":              "south dakota state",
  "s. dakota state":         "south dakota state",
  "new mex":                 "new mexico",
  "nmsu":                    "new mexico state",
  "utsa":                    "utsa",
  "ut san antonio":          "utsa",
  "jmu":                     "james madison",
  "coasta carolina":         "coastal carolina",
  "sam houston state":       "sam houston",
  "shsu":                    "sam houston",
  "jsu":                     "jackson state",
  "uab":                     "uab",
  "middle tenn":             "middle tennessee",
  "middle tenn.":            "middle tennessee",
  "mtsu":                    "middle tennessee",
  "la tech":                 "louisiana tech",
  "ltu":                     "louisiana tech",
  "tx tech":                 "texas tech",
  "ttu":                     "texas tech",
  "wvu":                     "west virginia",
  "w. virginia":             "west virginia",
  "bgsu":                    "bowling green",
  "bowling green state":     "bowling green",
  "ecu":                     "east carolina",
  "ucf":                     "ucf",
  "central florida":         "ucf",
  "miami fl":                "miami",
  "miami (fl)":              "miami",
  "miami florida":           "miami",
  "miami oh":                "miami (oh)",
  "miami ohio":              "miami (oh)",
  "miami of ohio":           "miami (oh)",
  "fgcu":                    "florida gulf coast",
  "lsu":                     "lsu",
  "ok state":                "oklahoma state",
  "okst":                    "oklahoma state",
  "ou":                      "oklahoma",
  "ut":                      "texas",
  "uta":                     "texas",
  "cal":                     "california",
  "uw":                      "washington",
  "uo":                      "oregon",
  "byu":                     "byu",
  "brigham young":           "byu",
  "wheeling":                "wheeling",
  "ucd":                     "california",
  "uc davis":                "california",
  // Handle case where team name includes full "Cornhuskers" etc.
  "nebraska cornhuskers":    "nebraska",
  "florida state seminoles": "florida state",
};

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------
export function resolveScheme(school: string | null | undefined): SchemeProfile | null {
  if (!school) return null;

  // Normalize: lowercase, strip punctuation artifacts, trim
  const normalized = school
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Direct hit
  if (SCHOOL_SCHEMES[normalized]) return SCHOOL_SCHEMES[normalized];

  // Alias hit
  const aliased = SCHOOL_ALIASES[normalized];
  if (aliased && SCHOOL_SCHEMES[aliased]) return SCHOOL_SCHEMES[aliased];

  // Partial match fallback (first word of school in key)
  const firstWord = normalized.split(" ")[0];
  const partialKey = Object.keys(SCHOOL_SCHEMES).find(
    (k) => k.startsWith(firstWord) && firstWord.length > 3
  );
  if (partialKey) return SCHOOL_SCHEMES[partialKey];

  return null;
}
