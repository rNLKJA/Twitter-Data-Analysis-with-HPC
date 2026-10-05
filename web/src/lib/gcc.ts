/**
 * Greater Capital City Statistical Areas (GCCSA) as coded in sal.json.
 * Coordinates are approximate CBD locations used only for drawing.
 */
export interface GccInfo {
  code: string;
  /** Short label used in the original Task 3 strings (code without the leading digit). */
  short: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  /** CSS custom property holding this city's categorical colour. */
  colorVar: string;
}

export const GCC_LIST: readonly GccInfo[] = [
  { code: "1gsyd", short: "gsyd", name: "Greater Sydney", city: "Sydney", state: "NSW", lat: -33.8688, lon: 151.2093, colorVar: "--gcc-syd" },
  { code: "2gmel", short: "gmel", name: "Greater Melbourne", city: "Melbourne", state: "VIC", lat: -37.8136, lon: 144.9631, colorVar: "--gcc-mel" },
  { code: "3gbri", short: "gbri", name: "Greater Brisbane", city: "Brisbane", state: "QLD", lat: -27.4698, lon: 153.0251, colorVar: "--gcc-bri" },
  { code: "4gade", short: "gade", name: "Greater Adelaide", city: "Adelaide", state: "SA", lat: -34.9285, lon: 138.6007, colorVar: "--gcc-ade" },
  { code: "5gper", short: "gper", name: "Greater Perth", city: "Perth", state: "WA", lat: -31.9505, lon: 115.8605, colorVar: "--gcc-per" },
  { code: "6ghob", short: "ghob", name: "Greater Hobart", city: "Hobart", state: "TAS", lat: -42.8821, lon: 147.3272, colorVar: "--gcc-hob" },
  { code: "7gdar", short: "gdar", name: "Greater Darwin", city: "Darwin", state: "NT", lat: -12.4634, lon: 130.8456, colorVar: "--gcc-dar" },
  { code: "8acte", short: "acte", name: "Australian Capital Territory", city: "Canberra", state: "ACT", lat: -35.2809, lon: 149.13, colorVar: "--gcc-act" },
  { code: "9oter", short: "oter", name: "Other Territories", city: "Other Territories", state: "OT", lat: -10.4475, lon: 105.6904, colorVar: "--gcc-oth" },
];

const BY_CODE = new Map(GCC_LIST.map((g) => [g.code, g]));
const BY_SHORT = new Map(GCC_LIST.map((g) => [g.short, g]));

export function gccInfo(code: string): GccInfo | undefined {
  return BY_CODE.get(code);
}

export function gccByShort(short: string): GccInfo | undefined {
  return BY_SHORT.get(short);
}

/** Human label for any sal.json gcc code, including rural ones such as `1rnsw`. */
export function gccLabel(code: string | null): string {
  if (!code) return "Unresolved";
  const known = BY_CODE.get(code);
  if (known) return known.name;
  const rural: Record<string, string> = {
    "1rnsw": "Rest of NSW",
    "2rvic": "Rest of Victoria",
    "3rqld": "Rest of Queensland",
    "4rsau": "Rest of South Australia",
    "5rwau": "Rest of Western Australia",
    "6rtas": "Rest of Tasmania",
    "7rnte": "Rest of Northern Territory",
  };
  return rural[code] ?? code;
}

export function isRural(code: string | null): boolean {
  return !!code && /\dr[a-z]{3}/.test(code);
}
