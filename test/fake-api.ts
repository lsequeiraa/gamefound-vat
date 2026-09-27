import type { Api } from "../src/api";
import type { CartDetails, CartSummary, OrderDetails, ProjectLocation } from "../src/types";
import detailsPledged from "./fixtures/cart-details-pledged.json";
import summaryGuest from "./fixtures/cart-summary-guest.json";
import summaryPledged from "./fixtures/cart-summary-pledged.json";
import locations from "./fixtures/project-locations.json";

export const fixtures = {
  summaryGuest: summaryGuest as CartSummary,
  summaryPledged: summaryPledged as CartSummary,
  detailsPledged: detailsPledged.data as CartDetails,
  locations: locations as ProjectLocation[],
};

export const PORTUGAL = 982239;
export const AZORES = fixtures.locations.find((l) => l.name === "Portugal (Azores)")!.projectLocationID;
export const AFGHANISTAN = fixtures.locations.find((l) => l.name === "Afghanistan")!.projectLocationID;

export function withLocation(summary: CartSummary, projectLocationID: number, subLocationID: number | null = null): CartSummary {
  const loc = fixtures.locations.find((l) => l.projectLocationID === projectLocationID)!;
  return {
    ...summary,
    userPreferredLocation: { projectLocationID, projectSubLocationID: subLocationID, locationName: loc.name },
  };
}

export function fakeApi(overrides: Partial<Api> = {}): Api & { calls: string[] } {
  const calls: string[] = [];
  const track =
    <A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) =>
    (...args: A) => {
      calls.push(name);
      return fn(...args);
    };
  const api: Api = {
    cartSummary: async () => fixtures.summaryGuest,
    cartDetails: async () => fixtures.detailsPledged,
    projectLocations: async () => fixtures.locations,
    backerPledges: async () => [],
    orderDetails: async (): Promise<OrderDetails> => {
      throw new Error("no orders");
    },
    ...overrides,
  };
  return {
    calls,
    cartSummary: track("cartSummary", api.cartSummary),
    cartDetails: track("cartDetails", api.cartDetails),
    projectLocations: track("projectLocations", api.projectLocations),
    backerPledges: track("backerPledges", api.backerPledges),
    orderDetails: track("orderDetails", api.orderDetails),
  };
}
