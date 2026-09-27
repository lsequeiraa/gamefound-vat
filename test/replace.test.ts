import { beforeEach, describe, expect, test } from "bun:test";
import { ensureNote, noteText } from "../src/note";
import { findProjectId, isExcludedPage } from "../src/page";
import type { Resolution, Vat } from "../src/rate";
import { PriceReplacer, productIdFor, type ReplacerOptions } from "../src/replace";

const page = await Bun.file(new URL("./fixtures/rewards-page.html", import.meta.url)).text();

const text = (selector: string) =>
  [...document.querySelectorAll(selector)].map((e) => e.textContent?.trim().replace(/\s+/g, " "));

function replacer(opts: Partial<ReplacerOptions> = {}) {
  return new PriceReplacer(document, { enabled: true, approx: false, netCartTotals: false, rateFor: () => 0.23, ...opts });
}

beforeEach(() => {
  document.body.innerHTML = page;
  location.hash = "";
});

describe("PriceReplacer", () => {
  test("adds VAT to every price on a card, and to the currency tooltip", () => {
    replacer().apply();
    expect(text('[data-qa^="price-type:"]')).toEqual(["€537.39", "€613.54", "€537.39", "€32.00"]);
    expect(text('[data-qa="tooltip-text"] [format-key] > *')).toEqual(["$599.01", "$683.88"]);
  });

  test("≈ only on the main price of an estimate", () => {
    replacer({ approx: true }).apply();
    expect(text('[data-qa="price-type:Effective"]')).toEqual(["≈€537.39", "≈€32.00"]);
    expect(text('[data-qa="price-type:Old"]')).toEqual(["€613.54"]);
  });

  test("is idempotent", () => {
    const r = replacer();
    r.apply();
    r.apply();
    expect(text('[data-qa="price-type:Effective"]')).toEqual(["€537.39", "€32.00"]);
  });

  test("switching off restores the site's text exactly", () => {
    const before = document.body.innerHTML;
    const r = replacer();
    r.apply();
    r.setEnabled(false);
    r.apply();
    expect(document.body.innerHTML).toBe(before);
  });

  test("follows the site when it re-renders a price", () => {
    const r = replacer();
    r.apply();
    const node = document.querySelector('[data-qa="price-type:Effective"]')!.firstChild as Text;
    node.nodeValue = "€100.00"; // e.g. a different display currency
    r.apply();
    expect(node.nodeValue).toBe("€123.00");
    r.setEnabled(false);
    r.apply();
    expect(node.nodeValue).toBe("€100.00");
  });

  test("per-product rates", () => {
    replacer({ rateFor: (el) => (productIdFor(el) === 66852 ? 0.06 : 0.23) }).apply();
    expect(text('[data-qa="price-type:Effective"]')).toEqual(["€537.39", "€27.58"]);
  });

  describe("mini-cart", () => {
    const miniCart = (label: string) =>
      `<div data-qa="project-mini-wizard"><div class="gfu-project-mini-wizard__price">$29.00</div><div class="gfu-project-mini-wizard__caption">${label}</div>` +
      `<span data-qa="mini-wizard:YourPledgePrice">€491.05</span><div data-qa="mini-wizard-item-warning:Tax">${label}</div>` +
      `<div class="gfu-project-mini-wizard__price" data-qa="mini-wizard:UsedCreditsAmount">-$5.00</div></div>`;

    test("net totals labelled +tax get VAT and a new label", () => {
      document.body.innerHTML = miniCart("+tax");
      replacer({ approx: true, netCartTotals: true }).apply();
      expect(document.body.textContent).toBe("≈$35.67incl. VAT≈€603.99incl. VAT-$5.00");
    });

    test("totals that already include tax are left alone", () => {
      document.body.innerHTML = miniCart("incl. tax");
      const before = document.body.innerHTML;
      replacer({ netCartTotals: false }).apply();
      expect(document.body.innerHTML).toBe(before);
    });
  });
});

describe("productIdFor", () => {
  test("reward card, add-on card and a tooltip teleported to <body>", () => {
    const prices = document.querySelectorAll('[data-qa="price-type:Effective"]');
    expect(productIdFor(prices[0]!)).toBe(69026);
    expect(productIdFor(prices[1]!)).toBe(66852);
    expect(productIdFor(document.querySelector('[data-qa="tooltip-text"] ._whs-nw')!)).toBe(69026);
  });

  test("product popup uses the URL", () => {
    document.body.innerHTML = '<div class="gfu-modal"><span data-qa="price-type:Effective">€26.02</span></div>';
    location.hash = "#/product/66852";
    expect(productIdFor(document.querySelector("span")!)).toBe(66852);
  });
});

describe("note", () => {
  const vat: Vat = {
    rate: 0.23,
    byProduct: new Map(),
    exact: true,
    source: "pledge",
    locationName: "Portugal",
    netCartTotals: false,
  };
  const note = () => document.querySelector<HTMLButtonElement>(".gfvat-note");

  test("texts", () => {
    expect(noteText({ kind: "rate", vat }, true)?.text).toBe("prices incl. 23% VAT");
    expect(noteText({ kind: "rate", vat: { ...vat, exact: false, source: "orders" } }, true)?.text).toBe(
      "prices incl. ≈23% VAT",
    );
    expect(noteText({ kind: "rate", vat }, false)?.text).toBe("prices excl. VAT");
    expect(noteText({ kind: "none", reason: "unknown", locationName: "Canada" }, true)).toMatchObject({
      text: "prices excl. VAT (rate unknown)",
      clickable: false,
    });
    expect(noteText({ kind: "none", reason: "no-tax", locationName: "" }, true)).toBeNull();
  });

  test("sits in the delivery bar, once, and toggles on click", () => {
    let clicks = 0;
    const res: Resolution = { kind: "rate", vat };
    ensureNote(document, noteText(res, true), () => clicks++);
    ensureNote(document, noteText(res, true), () => clicks++);
    expect(document.querySelectorAll(".gfvat-note")).toHaveLength(1);
    expect(note()?.parentElement?.getAttribute("data-qa")).toBe("delivery-to:LocationBar");
    expect(note()?.title).toContain("from your pledge on this project");
    note()!.click();
    expect(clicks).toBe(1);
  });

  test("a note that is not clickable does nothing", () => {
    let clicks = 0;
    ensureNote(document, noteText({ kind: "none", reason: "unknown", locationName: "" }, true), () => clicks++);
    note()!.click();
    expect(clicks).toBe(0);
  });
});

describe("page", () => {
  test("project ID from __INITIAL_STATE__", () => {
    document.body.innerHTML =
      '<script>window.__INITIAL_STATE__ = {"userAdditionalInfo":{"backedProjectsIDs":[2757]},"projectContext":{"creator":{"creatorID":1},"projectID":3850}};</script>';
    expect(findProjectId(document)).toBe(3850);
    document.body.innerHTML = '<script>window.__INITIAL_STATE__ = {"projectContext":{"projectID":0}};</script>';
    expect(findProjectId(document)).toBeNull();
  });

  test.each([
    ["/en/projects/awaken-realms/lands-of-evershade", false],
    ["/en/projects/awaken-realms/lands-of-evershade/rewards", false],
    ["/en/projects/someone/pledge", false],
    ["/en/projects/awaken-realms/lands-of-evershade/yourpledge", true],
    ["/en/projects/awaken-realms/lands-of-evershade/pledge/authenticate", true],
    ["/projects/awaken-realms/lands-of-evershade/orders/cancelorder", true],
  ])("isExcludedPage(%p) = %p", (path, excluded) => {
    expect(isExcludedPage(path)).toBe(excluded);
  });
});
