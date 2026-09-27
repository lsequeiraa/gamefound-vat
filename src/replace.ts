import { withVat } from "./price";

// Prices shown before tax. Anything that already includes tax (the "Your
// pledge" and checkout pages, a mini-cart labelled "incl. tax") is left alone.
const PRICES = [
  '[data-qa^="price-type:"]',
  '[data-qa^="mini-wizard-featured-reward-price:"]',
  // The currency tooltip: "Approximate conversion from $487.00 ~~$556.00~~".
  '[data-qa="tooltip-text"] [format-key] ._whs-nw',
  '[data-qa="tooltip-text"] [format-key] s',
].join(",");

// Mini-cart totals; only before tax while the site labels them "+tax".
const CART_TOTALS = [
  '.gfu-project-mini-wizard__price:not([data-qa="mini-wizard:UsedCreditsAmount"])',
  '[data-qa="mini-wizard:YourPledgePrice"]',
  '[data-qa="mini-wizard:OriginalPledge"]',
  '[data-qa="mini-wizard-header:AlreadyPledged"]',
].join(",");
const CART_TAX_LABELS = [
  '[data-qa="mini-wizard-item-warning:Tax"]',
  ".gfu-project-mini-wizard__price + .gfu-project-mini-wizard__caption",
].join(",");

// Main prices get the "≈" of an estimate; secondary ones (struck-through,
// 30-day lowest, tooltips) stay unmarked to keep the cards readable.
const MAIN = [
  '[data-qa="price-type:Effective"]',
  '[data-qa="mini-wizard-featured-reward-price:Effective"]',
  CART_TOTALS,
].join(",");

export interface ReplacerOptions {
  enabled: boolean;
  approx: boolean;
  netCartTotals: boolean;
  rateFor(el: Element): number;
}

export class PriceReplacer {
  /** Text as the site last wrote it. */
  private original = new WeakMap<Text, string>();
  /** Text as this extension last wrote it. */
  private written = new WeakMap<Text, string>();

  constructor(
    private root: ParentNode,
    private opts: ReplacerOptions,
  ) {}

  setEnabled(enabled: boolean): void {
    this.opts.enabled = enabled;
  }

  /** Brings every price in `root` in line with the current options. Safe to call repeatedly. */
  apply(): void {
    const seen = new Set<Text>();
    for (const el of this.root.querySelectorAll(PRICES)) this.update(el, seen);
    if (this.opts.netCartTotals) {
      for (const el of this.root.querySelectorAll(CART_TOTALS)) this.update(el, seen);
      for (const el of this.root.querySelectorAll(CART_TAX_LABELS)) {
        for (const node of textNodes(el)) {
          if (seen.has(node) || !node.nodeValue?.trim()) continue;
          seen.add(node);
          this.write(node, () => "incl. VAT");
        }
      }
    }
  }

  private update(el: Element, seen: Set<Text>): void {
    const approx = this.opts.approx && el.matches(MAIN);
    const rate = this.opts.rateFor(el);
    for (const node of textNodes(el)) {
      if (seen.has(node) || !/\d/.test(node.nodeValue ?? "")) continue;
      seen.add(node);
      this.write(node, (original) => withVat(original, rate, approx));
    }
  }

  private write(node: Text, convert: (original: string) => string): void {
    const current = node.nodeValue ?? "";
    // Anything this extension did not write is the site's own, possibly new, value.
    if (this.written.get(node) !== current) {
      this.original.set(node, current);
      this.written.delete(node);
    }
    const original = this.original.get(node)!;
    const desired = this.opts.enabled ? convert(original) : original;
    if (desired !== current) node.nodeValue = desired;
    if (desired !== original) this.written.set(node, desired);
    else this.written.delete(node);
  }
}

function* textNodes(el: Element): Generator<Text> {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) yield n as Text;
}

/** The product a price belongs to, if any: reward and add-on cards, the product popup. */
export function productIdFor(el: Element, doc: Document = el.ownerDocument): number | null {
  let anchor: Element = el;
  const tip = el.closest('[data-qa="tooltip-text"]');
  const tipId = tip?.getAttribute("data-value");
  if (tipId) {
    const trigger = doc.querySelector(`[data-qa="tooltip-trigger"][data-value="${CSS.escape(tipId)}"]`);
    if (trigger) anchor = trigger;
  }

  const link = anchor.closest('a[href*="#/product/"], [data-qa^="product-card:"]');
  const fromLink = link && /(?:#\/product\/|product-card:)(\d+)/.exec(link.getAttribute("href") ?? link.getAttribute("data-qa") ?? "");
  if (fromLink) return Number(fromLink[1]);

  if (anchor.closest(".gfu-modal")) {
    const fromHash = /#\/product\/(\d+)/.exec(doc.location?.hash ?? "");
    if (fromHash) return Number(fromHash[1]);
  }

  // Cards whose price sits beside, not inside, the product link.
  let node: Element | null = anchor.parentElement;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const ids = new Set(
      [...node.querySelectorAll('a[href*="#/product/"]')].map((a) => /#\/product\/(\d+)/.exec(a.getAttribute("href")!)?.[1]),
    );
    if (ids.size === 1) return Number([...ids][0]);
    if (ids.size > 1) break;
  }
  return null;
}
