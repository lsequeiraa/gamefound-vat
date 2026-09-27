import { describe, expect, test } from "bun:test";
import { createLearnedLookup, learnRates, MAX_AGE_MS, MAX_ORDERS, type LearnedCache } from "../src/learned";
import type { OrderDetails, TaxInfo } from "../src/types";
import { AZORES, PORTUGAL, fakeApi } from "./fake-api";

const taxes = (standard: number | null): TaxInfo[] => [
  { taxRateType: 0, taxRate: standard },
  { taxRateType: 1, taxRate: 0.06 },
];
const order = (handleTax: boolean, standard: number | null, location: number | null = PORTUGAL): OrderDetails => ({
  order: { handleTax, taxInfos: handleTax ? taxes(standard) : null, customerProjectLocationID: location },
});

// Shaped like the user's real history: mostly 23%, one project at 0%, one without tax.
const orders: Record<string, OrderDetails> = {
  A: order(true, 0.23),
  B: order(true, 0.23),
  C: order(true, 0),
  D: order(false, null),
  E: order(true, 0.16, AZORES),
};

function historyApi() {
  return fakeApi({
    backerPledges: async () =>
      Object.keys(orders).map((code, i) => ({
        projectID: 100 + i,
        yourPledgeUrl: `/projects/someone/project-${i}/yourpledge?orderCode=${code}`,
      })),
    orderDetails: async (_projectID, code) => orders[code]!,
  });
}

describe("learnRates", () => {
  test("most common standard rate per location", async () => {
    expect(await learnRates(historyApi())).toEqual({ "PT|Portugal": 0.23, "PT|Portugal (Azores)": 0.16 });
  });

  test(`reads only the ${MAX_ORDERS} most recent orders`, async () => {
    const pledges = Array.from({ length: 30 }, (_, i) => ({
      projectID: i,
      // Listed oldest first, so taking the list's head would read the wrong ones.
      createdAt: new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
      yourPledgeUrl: `/p/yourpledge?orderCode=${i >= 20 ? "A" : "C"}`,
    }));
    const api = fakeApi({ backerPledges: async () => pledges, orderDetails: async (_id, code) => orders[code]! });
    // The 10 newest are all 23% orders; the 20 older 0% ones are never read.
    expect(await learnRates(api)).toEqual({ "PT|Portugal": 0.23 });
    expect(api.calls.filter((c) => c === "orderDetails")).toHaveLength(MAX_ORDERS);
  });

  test("one unreadable order does not lose the others", async () => {
    const api = fakeApi({
      backerPledges: async () => [
        { projectID: 1, yourPledgeUrl: "/p/yourpledge?orderCode=bad" },
        { projectID: 2, yourPledgeUrl: "/p/yourpledge?orderCode=A" },
      ],
      orderDetails: async (_id, code) => {
        if (code === "bad") throw new Error("500");
        return orders[code]!;
      },
    });
    expect(await learnRates(api)).toEqual({ "PT|Portugal": 0.23 });
  });
});

describe("createLearnedLookup", () => {
  const memoryStore = (initial: LearnedCache | null = null) => {
    let value = initial;
    return {
      get: async () => value,
      set: async (c: LearnedCache) => {
        value = c;
      },
      peek: () => value,
    };
  };

  test("learns once, then serves from the cache", async () => {
    const api = historyApi();
    const store = memoryStore();
    const lookup = createLearnedLookup(api, store, () => 1_000);
    expect(await lookup("PT|Portugal")).toBe(0.23);
    expect(await lookup("PT|Nowhere")).toBeNull();
    expect(api.calls.filter((c) => c === "backerPledges")).toHaveLength(1);
    expect(store.peek()).toMatchObject({ fetchedAt: 1_000 });

    const again = historyApi();
    await createLearnedLookup(again, store, () => 1_000 + MAX_AGE_MS - 1)("PT|Portugal");
    expect(again.calls).toEqual([]);
  });

  test("refreshes a stale cache, and keeps it when refreshing fails", async () => {
    const store = memoryStore({ fetchedAt: 0, rates: { "PT|Portugal": 0.21 } });
    const loggedOut = fakeApi({
      backerPledges: async () => {
        throw new Error("401");
      },
    });
    expect(await createLearnedLookup(loggedOut, store, () => MAX_AGE_MS + 1)("PT|Portugal")).toBe(0.21);
    expect(await createLearnedLookup(historyApi(), store, () => MAX_AGE_MS + 1)("PT|Portugal")).toBe(0.23);
  });
});
