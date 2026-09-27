// Only the fields this extension reads from Gamefound's internal API.

export interface TaxInfo {
  /** 0 standard, 1 and 2 reduced, 3 zero, 4 unknown. */
  taxRateType: number;
  /** A fraction: 0.23 means 23%. */
  taxRate: number | null;
}

export interface CartItem {
  productID: number | null;
  taxRate: number | null;
}

export interface CartSummary {
  cart?: {
    cart?: {
      hasTaxHandlingEnabled: boolean;
      /** True once the cart's delivery country is saved, i.e. prices in the cart include tax. */
      hasTaxInfoDefined: boolean;
      orderItems?: CartItem[] | null;
    } | null;
  } | null;
  userPreferredLocation?: {
    projectLocationID: number | null;
    projectSubLocationID: number | null;
    locationName: string | null;
  } | null;
}

export interface CartDetails {
  cart: {
    handleTax: boolean;
    taxInfos: TaxInfo[] | null;
  };
}

export interface ProjectLocation {
  projectLocationID: number;
  name: string;
  projectLocationIsoCode: string;
  /** 1 EU VAT, 2 UK VAT (both collected by Gamefound), 0 anything else. */
  taxRegulation: number;
}

export interface BackerPledge {
  projectID: number;
  yourPledgeUrl: string;
}

export interface BackerPledgesPage {
  pagedPledges: {
    pagedItems: BackerPledge[];
    totalPageCount: number;
  };
}

export interface OrderDetails {
  order: {
    handleTax: boolean;
    taxInfos: TaxInfo[] | null;
    customerProjectLocationID: number | null;
  };
}
