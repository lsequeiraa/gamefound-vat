# Gamefound VAT

A browser extension for Chrome and Firefox that shows Gamefound reward and add-on prices **including the VAT** for your delivery country.

Gamefound lists prices before tax and adds VAT at checkout. Once you have a pledge your cart includes VAT but the reward cards don't, so the numbers on the page never match your cart. This extension replaces each price with the price you will actually pay, in whatever display currency you picked; it does no currency conversion of its own.

- The "Delivery to" bar shows which rate is applied, e.g. `· prices incl. 23% VAT`. Hover it to see where the rate came from; click it to switch back to the original prices.
- The toolbar button has the same switch ("Show prices incl. VAT"), remembered across pages.
- `≈` in front of a price means the rate is an estimate.

## Where the rate comes from

1. **Your pledge on this project (exact).** Gamefound's cart lists the rates it charges you, per product. No `≈`.
2. **Your past Gamefound orders (estimate).** When you have no pledge here, the extension uses the standard rate Gamefound charged on your other orders to the same delivery location (the most common one). Refreshed at most once a day, only while you are logged in.
3. **A built-in table (estimate).** Standard EU and UK rates, including the Azores and Madeira, in `src/vat-rates.ts` with sources and the date checked.
4. **Nothing.** Outside the EU and UK the rate depends on the creator, so prices stay as they are and the bar says `prices excl. VAT (rate unknown)`.

Projects without tax handling are left untouched, and so are the "Your pledge" and checkout pages, which already include tax.

Known limitation: a product with a reduced rate (e.g. books in some countries) shows the standard rate unless it is already in your cart.

## Install

Build first: `bun install && bun run build`. The result in `dist/` works in both browsers.

- **Chrome:** `chrome://extensions` → enable Developer mode → *Load unpacked* → pick `dist/`.
- **Firefox (temporary):** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick `dist/manifest.json`. It is removed when Firefox restarts.
- **Firefox (permanent):** sign it as an unlisted add-on on addons.mozilla.org: `npx web-ext sign --source-dir dist --channel unlisted --api-key … --api-secret …`, then install the `.xpi` it produces.

## Development

```sh
bun test            # unit and DOM tests (happy-dom), fixtures captured from gamefound.com
bun run typecheck
bun run lint        # build + web-ext lint (Firefox's validator)
bun run package     # zip for distribution into artifacts/
bun run firefox     # build and run in a fresh Firefox profile
```

It relies on Gamefound's internal, undocumented API (`/api/carts/getCartSummary`, `/api/carts/getCartDetails`, `/api/locations/getProjectLocations`, `/api/users/getBackerCenterPledges`, `/api/orders/getOrderDetails`) and on the site's `data-qa` attributes. If Gamefound changes them the extension stops changing prices rather than showing wrong ones; the tests in `test/` pin the shapes it expects.
