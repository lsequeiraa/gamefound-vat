import { describe, expect, test } from "bun:test";
import { exactFromCart, modeRate, resolveVat, type LearnedLookup } from "../src/rate";
import { tableRate } from "../src/vat-rates";
import { AFGHANISTAN, AZORES, fakeApi, fixtures, withLocation } from "./fake-api";

const noLearned: LearnedLookup = async () => null;

describe("resolveVat", () => {
  test("pledged: exact rates from the cart", async () => {
    const api = fakeApi({ cartSummary: async () => fixtures.summaryPledged });
    const res = await resolveVat(3850, api, noLearned);
    expect(res).toMatchObject({
      kind: "rate",
      vat: { rate: 0.23, exact: true, source: "pledge", taxName: "VAT", locationName: "Portugal", netCartTotals: false },
    });
    if (res.kind === "rate") expect(res.vat.byProduct.get(66862)).toBe(0.23);
    // The exact path never needs the location list or past orders.
    expect(api.calls).toEqual(["cartSummary", "cartDetails"]);
  });

  test("pledged: falls back to the items' rates when cart details fail", async () => {
    const api = fakeApi({
      cartSummary: async () => fixtures.summaryPledged,
      cartDetails: async () => {
        throw new Error("401");
      },
    });
    expect(await resolveVat(3850, api, noLearned)).toMatchObject({
      kind: "rate",
      vat: { rate: 0.23, exact: true, taxName: "tax" },
    });
  });

  test("pledged: uses Gamefound's own name for the tax", async () => {
    const api = fakeApi({
      cartSummary: async () => fixtures.summaryPledged,
      cartDetails: async () => ({
        cart: { handleTax: true, taxName: "Sales Tax", taxInfos: [{ taxRateType: 0, taxRate: 0.0725 }] },
      }),
    });
    expect(await resolveVat(3850, api, noLearned)).toMatchObject({ vat: { rate: 0.0725, taxName: "Sales Tax" } });
  });

  test("no pledge: rate learned from past orders wins over the table", async () => {
    const learned: LearnedLookup = async (key) => (key === "PT|Portugal" ? 0.22 : null);
    const res = await resolveVat(3850, fakeApi(), learned);
    expect(res).toMatchObject({ kind: "rate", vat: { rate: 0.22, exact: false, source: "orders", netCartTotals: true } });
  });

  test("no pledge, no past orders: table", async () => {
    expect(await resolveVat(3850, fakeApi(), noLearned)).toMatchObject({
      kind: "rate",
      vat: { rate: 0.23, exact: false, source: "table", taxName: "VAT", locationName: "Portugal" },
    });
  });

  test("regional rate for the Azores", async () => {
    const api = fakeApi({ cartSummary: async () => withLocation(fixtures.summaryGuest, AZORES) });
    expect(await resolveVat(3850, api, noLearned)).toMatchObject({ kind: "rate", vat: { rate: 0.16, source: "table" } });
  });

  test("a failing lookup of past orders still reaches the table", async () => {
    const failing: LearnedLookup = async () => {
      throw new Error("offline");
    };
    expect(await resolveVat(3850, fakeApi(), failing)).toMatchObject({ kind: "rate", vat: { source: "table" } });
  });

  test("outside the EU and UK: no estimate", async () => {
    const api = fakeApi({ cartSummary: async () => withLocation(fixtures.summaryGuest, AFGHANISTAN) });
    expect(await resolveVat(3850, api, async () => 0.23)).toEqual({
      kind: "none",
      reason: "unknown",
      locationName: "Afghanistan",
    });
  });

  test("project without tax handling", async () => {
    const summary = structuredClone(fixtures.summaryGuest);
    summary.cart!.cart!.hasTaxHandlingEnabled = false;
    const api = fakeApi({ cartSummary: async () => summary });
    expect(await resolveVat(3850, api, noLearned)).toMatchObject({ kind: "none", reason: "no-tax" });
    expect(api.calls).toEqual(["cartSummary"]);
  });
});

describe("exactFromCart", () => {
  test("per-product rates, standard from taxInfos", () => {
    const res = exactFromCart(
      [
        { productID: 1, taxRate: 0.06 },
        { productID: 2, taxRate: 0.23 },
        { productID: null, taxRate: 0.23 },
      ],
      [{ taxRateType: 0, taxRate: 0.23 }],
    );
    expect(res?.rate).toBe(0.23);
    expect(res?.byProduct.get(1)).toBe(0.06);
  });

  test("nothing to go on", () => {
    expect(exactFromCart([{ productID: 1, taxRate: null }], null)).toBeNull();
  });
});

test("modeRate ignores a one-off", () => {
  expect(modeRate([0.23, 0, 0.23, 0.23])).toBe(0.23);
  expect(modeRate([])).toBeNull();
});

test("tableRate", () => {
  const loc = (name: string, iso: string) => ({ name, projectLocationIsoCode: iso });
  expect(tableRate(loc("Portugal (Madeira)", "PT"))).toBe(0.22);
  expect(tableRate(loc("Finland", "FI"))).toBe(0.255);
  expect(tableRate(loc("Greece", "GR"))).toBe(0.24);
  expect(tableRate(loc("Northern Ireland", "GB"))).toBe(0.2);
  expect(tableRate(loc("Norway", "NO"))).toBeNull();
});
