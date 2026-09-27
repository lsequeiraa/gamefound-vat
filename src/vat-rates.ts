import type { ProjectLocation } from "./types";

// Fallback only: used when neither your pledge on this project nor your past
// Gamefound orders give a rate for your delivery location.
//
// Sources, checked 2026-09-27:
// - EU: European Commission, "VAT rates applied in EU member countries",
//   https://europa.eu/youreurope/business/finance-and-tax/vat/vat-rules-rates/index_en.htm
// - UK (incl. Northern Ireland, Isle of Man): 20%, https://www.gov.uk/vat-rates
// - Monaco applies French VAT.
// - Azores 16% and Madeira 22%: Portuguese VAT code (CIVA), art. 18(3).
export const TABLE_CHECKED = "2026-09-27";

const BY_ISO: Record<string, number> = {
  AT: 0.2,
  BE: 0.21,
  BG: 0.2,
  CY: 0.19,
  CZ: 0.21,
  DE: 0.19,
  DK: 0.25,
  EE: 0.24,
  ES: 0.21,
  FI: 0.255,
  FR: 0.2,
  GB: 0.2,
  GR: 0.24,
  HR: 0.25,
  HU: 0.27,
  IE: 0.23,
  IT: 0.22,
  LT: 0.21,
  LU: 0.17,
  LV: 0.21,
  MC: 0.2,
  MT: 0.18,
  NL: 0.21,
  PL: 0.23,
  PT: 0.23,
  RO: 0.21,
  SE: 0.25,
  SI: 0.22,
  SK: 0.23,
};

// Gamefound locations that share an ISO code with a different rate.
const BY_NAME: Record<string, number> = {
  "Portugal (Azores)": 0.16,
  "Portugal (Madeira)": 0.22,
};

export function tableRate(loc: Pick<ProjectLocation, "name" | "projectLocationIsoCode">): number | null {
  return BY_NAME[loc.name] ?? BY_ISO[loc.projectLocationIsoCode] ?? null;
}
