# Chrome Web Store listing

Text and answers to paste into the Developer Dashboard for the first submission.
Later versions are uploaded by the release workflow; this listing only needs
editing here and in the dashboard if it changes.

## Package

Upload `gamefound-vat-<version>-chrome.zip` from the GitHub Release.

## Store listing

**Description** (the summary line comes from the manifest):

```
Gamefound lists reward and add-on prices before tax and only adds VAT at checkout. Once you have a pledge your cart includes VAT but the reward cards don't, so the numbers never line up.

This extension replaces each price on a Gamefound project page with the price you will actually pay, VAT included, in whatever display currency you picked on Gamefound.

• The "Delivery to" bar shows the rate used, e.g. "prices incl. 23% VAT". Hover it to see where the rate came from; click it to switch back to the original prices.
• The toolbar button has the same switch.
• "≈" marks an estimated rate.

Where the rate comes from
1. Your pledge on the project: the exact rates Gamefound charges you.
2. No pledge there: the rate Gamefound charged on your recent orders to the same country (only while logged in).
3. Otherwise the standard EU or UK VAT rate for your delivery country.

Outside the EU and the UK, where the rate depends on the creator, prices are left as they are unless you have a pledge on the project.

Privacy: everything happens in your browser. The extension reads your cart and recent orders from Gamefound using your own login, keeps only an on/off setting and one learned rate per country, and sends nothing anywhere.

Unofficial and not affiliated with Gamefound. Open source: https://github.com/lsequeiraa/gamefound-vat
```

- **Category:** Shopping
- **Language:** English
- **Store icon:** `static/icons/128.png`
- **Screenshots:** `store/screenshot-1.jpg` … `store/screenshot-4.jpg` (1280×800)
- **Small promo tile:** `store/promo-440x280.jpg`
- **Homepage URL:** https://github.com/lsequeiraa/gamefound-vat
- **Support URL:** https://github.com/lsequeiraa/gamefound-vat/issues

## Privacy practices

**Single purpose:**

```
Show prices on gamefound.com with the VAT for the user's delivery country included, so reward and add-on prices match what the user pays at checkout.
```

**Permission justification: `storage`**

```
Remembers whether the user switched the VAT prices on or off, and caches the VAT rate learned from the user's recent Gamefound orders (one number per delivery country) so it is not re-read on every page.
```

**Permission justification: host permission (`https://gamefound.com/*`, content script)**

```
The extension only runs on gamefound.com. It rewrites the prices shown on Gamefound project pages and reads, from Gamefound's own website using the user's existing session, the cart and recent order tax details needed to know which VAT rate applies.
```

**Remote code:** No, I am not using remote code.

**Data usage**: tick these (the data is read and used only inside the browser, but Chrome asks for local handling to be disclosed too):

- [x] Financial and payment information: the tax rates on the user's Gamefound cart and recent orders
- [x] Website content: prices on Gamefound pages

and certify all three statements (not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending).

**Privacy policy URL:** https://github.com/lsequeiraa/gamefound-vat/blob/main/PRIVACY.md

## Distribution

Public, all regions, free.
