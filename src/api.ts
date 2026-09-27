import type {
  BackerPledge,
  BackerPledgesPage,
  CartDetails,
  CartSummary,
  OrderDetails,
  ProjectLocation,
} from "./types";

export interface Api {
  cartSummary(projectID: number): Promise<CartSummary>;
  cartDetails(projectID: number): Promise<CartDetails>;
  projectLocations(projectID: number): Promise<ProjectLocation[]>;
  backerPledges(): Promise<BackerPledge[]>;
  orderDetails(projectID: number, orderCode: string): Promise<OrderDetails>;
}

export class ApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`Gamefound API ${path} answered ${status}`);
  }
}

type FetchFn = (url: string) => Promise<Response>;

// Firefox runs content-script fetches as the extension, with a different
// Origin; `content.fetch` sends them as the page would. Chrome already does.
declare const content: { fetch: typeof fetch } | undefined;

export function pageFetch(): FetchFn {
  if (typeof content !== "undefined" && typeof content?.fetch === "function") {
    return (url) => content!.fetch(url);
  }
  return (url) => fetch(url);
}

export function createApi(fetchFn: FetchFn = pageFetch(), origin = "https://gamefound.com"): Api {
  const get = async <T>(path: string, params: Record<string, string | number> = {}): Promise<T> => {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const res = await fetchFn(`${origin}/api/${path}${query.size ? `?${query}` : ""}`);
    if (!res.ok) throw new ApiError(path, res.status);
    // Parse the text here so the objects belong to this script, not the page.
    const body = JSON.parse(await res.text());
    // Some endpoints wrap their payload in {success, message, data}.
    if (body && typeof body === "object" && "success" in body && "data" in body) {
      if (!body.success) throw new ApiError(path, res.status);
      return body.data as T;
    }
    return body as T;
  };

  return {
    cartSummary: (projectID) => get("carts/getCartSummary", { projectID }),
    cartDetails: (projectID) => get("carts/getCartDetails", { projectID }),
    projectLocations: (projectID) => get("locations/getProjectLocations", { projectID }),
    orderDetails: (projectID, orderCode) => get("orders/getOrderDetails", { projectID, orderCode }),
    async backerPledges() {
      const pledges: BackerPledge[] = [];
      for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
        const page = await get<BackerPledgesPage>("users/getBackerCenterPledges", { pageIndex });
        pledges.push(...page.pagedPledges.pagedItems);
        if (pageIndex + 1 >= page.pagedPledges.totalPageCount) break;
      }
      return pledges;
    },
  };
}
