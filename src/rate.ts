import type { Api } from "./api";
import type { CartItem, ProjectLocation, TaxInfo } from "./types";
import { tableRate } from "./vat-rates";

export type Source = "pledge" | "orders" | "table";

export interface Vat {
  /** Standard rate as a fraction (0.23). */
  rate: number;
  /** Rates Gamefound applied to specific products already in your cart. */
  byProduct: Map<number, number>;
  /** True when the rate comes from Gamefound for this project, false for estimates. */
  exact: boolean;
  source: Source;
  locationName: string;
  /** The mini-cart totals exclude tax (the site labels them "+tax"). */
  netCartTotals: boolean;
}

export type Resolution =
  | { kind: "rate"; vat: Vat }
  /** "no-tax": the project collects no tax. "unknown": it does, but no rate is known. */
  | { kind: "none"; reason: "no-tax" | "unknown"; locationName: string };

/** Looks up a rate learned from the user's past orders, keyed by `locationKey`. */
export type LearnedLookup = (key: string) => Promise<number | null>;

export function locationKey(loc: Pick<ProjectLocation, "name" | "projectLocationIsoCode">): string {
  return `${loc.projectLocationIsoCode}|${loc.name}`;
}

/** Gamefound itself collects EU and UK VAT, so a rate from elsewhere applies here too. */
export function isGamefoundVat(loc: Pick<ProjectLocation, "taxRegulation">): boolean {
  return loc.taxRegulation === 1 || loc.taxRegulation === 2;
}

export function standardRate(taxInfos: TaxInfo[] | null | undefined): number | null {
  return taxInfos?.find((t) => t.taxRateType === 0)?.taxRate ?? null;
}

/** The most frequent rate; ties go to the one seen first. */
export function modeRate(rates: number[]): number | null {
  const counts = new Map<number, number>();
  for (const r of rates) {
    const key = Math.round(r * 10000) / 10000;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [rate, count] of counts) {
    if (count > bestCount) {
      best = rate;
      bestCount = count;
    }
  }
  return best;
}

export function exactFromCart(
  items: CartItem[],
  taxInfos: TaxInfo[] | null,
): { rate: number; byProduct: Map<number, number> } | null {
  const byProduct = new Map<number, number>();
  for (const item of items) {
    if (item.productID != null && item.taxRate != null) byProduct.set(item.productID, item.taxRate);
  }
  const itemRates = items.flatMap((i) => (i.taxRate == null ? [] : [i.taxRate]));
  const rate = standardRate(taxInfos) ?? modeRate(itemRates);
  return rate == null ? null : { rate, byProduct };
}

export async function resolveVat(projectID: number, api: Api, learned: LearnedLookup): Promise<Resolution> {
  const summary = await api.cartSummary(projectID);
  const cart = summary.cart?.cart;
  const preferred = summary.userPreferredLocation;
  const locationName = preferred?.locationName ?? "";
  if (!cart?.hasTaxHandlingEnabled) return { kind: "none", reason: "no-tax", locationName };

  const netCartTotals = !cart.hasTaxInfoDefined;
  if (cart.hasTaxInfoDefined) {
    const details = await api.cartDetails(projectID).catch(() => null);
    const exact = exactFromCart(cart.orderItems ?? [], details?.cart.taxInfos ?? null);
    if (exact) {
      return { kind: "rate", vat: { ...exact, exact: true, source: "pledge", locationName, netCartTotals } };
    }
  }

  const unknown: Resolution = { kind: "none", reason: "unknown", locationName };
  if (preferred?.projectLocationID == null || preferred.projectSubLocationID != null) return unknown;
  const locations = await api.projectLocations(projectID);
  const loc = locations.find((l) => l.projectLocationID === preferred.projectLocationID);
  if (!loc || !isGamefoundVat(loc)) return unknown;

  const estimate = (rate: number, source: Source): Resolution => ({
    kind: "rate",
    vat: { rate, byProduct: new Map(), exact: false, source, locationName: locationName || loc.name, netCartTotals },
  });
  const fromOrders = await learned(locationKey(loc)).catch(() => null);
  if (fromOrders != null) return estimate(fromOrders, "orders");
  const fromTable = tableRate(loc);
  if (fromTable != null) return estimate(fromTable, "table");
  return unknown;
}
