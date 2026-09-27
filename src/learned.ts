import type { Api } from "./api";
import { locationKey, modeRate, standardRate, type LearnedLookup } from "./rate";
import type { ProjectLocation } from "./types";

export interface LearnedCache {
  fetchedAt: number;
  /** Standard rate per `locationKey`, the most common one across your orders. */
  rates: Record<string, number>;
}

export interface LearnedStore {
  get(): Promise<LearnedCache | null>;
  set(cache: LearnedCache): Promise<void>;
}

export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Reads the standard VAT rate Gamefound charged on each of your orders and
 * keeps the most common one per delivery location.
 */
export async function learnRates(api: Api): Promise<Record<string, number>> {
  const samples = new Map<string, number[]>();
  const locationsByProject = new Map<number, ProjectLocation[]>();

  for (const pledge of await api.backerPledges()) {
    const orderCode = new URL(pledge.yourPledgeUrl, "https://gamefound.com").searchParams.get("orderCode");
    if (!orderCode) continue;
    try {
      const { order } = await api.orderDetails(pledge.projectID, orderCode);
      const rate = standardRate(order.taxInfos);
      if (!order.handleTax || rate == null || order.customerProjectLocationID == null) continue;

      let locations = locationsByProject.get(pledge.projectID);
      if (!locations) {
        locations = await api.projectLocations(pledge.projectID);
        locationsByProject.set(pledge.projectID, locations);
      }
      const loc = locations.find((l) => l.projectLocationID === order.customerProjectLocationID);
      if (!loc) continue;

      const key = locationKey(loc);
      samples.set(key, [...(samples.get(key) ?? []), rate]);
    } catch {
      // One unreadable order should not cost the others.
    }
  }

  const rates: Record<string, number> = {};
  for (const [key, list] of samples) {
    const rate = modeRate(list);
    if (rate != null) rates[key] = rate;
  }
  return rates;
}

export function createLearnedLookup(api: Api, store: LearnedStore, now = () => Date.now()): LearnedLookup {
  let loading: Promise<Record<string, number>> | null = null;

  const load = async (): Promise<Record<string, number>> => {
    const cached = await store.get().catch(() => null);
    if (cached && now() - cached.fetchedAt < MAX_AGE_MS) return cached.rates;
    try {
      const rates = await learnRates(api);
      await store.set({ fetchedAt: now(), rates });
      return rates;
    } catch {
      // Logged out or the API changed: fall back to whatever was learned before.
      return cached?.rates ?? {};
    }
  };

  return async (key) => {
    loading ??= load();
    return (await loading)[key] ?? null;
  };
}
