import { createApi } from "./api";
import { createLearnedLookup } from "./learned";
import { ensureNote, noteText } from "./note";
import { findProjectId, isExcludedPage } from "./page";
import { resolveVat, type Resolution } from "./rate";
import { PriceReplacer, productIdFor } from "./replace";
import { getEnabled, learnedStore, onEnabledChange, setEnabled } from "./settings";

async function main(): Promise<void> {
  if (isExcludedPage(location.pathname)) return;
  const projectID = findProjectId(document);
  if (!projectID) return;

  const api = createApi();
  let resolution: Resolution;
  try {
    resolution = await resolveVat(projectID, api, createLearnedLookup(api, learnedStore));
  } catch (error) {
    // Gamefound changed something or is unreachable: leave the page as it is.
    console.debug("[gamefound-vat]", error);
    return;
  }
  // No tax on this project, or no rate known for the location: change nothing.
  if (resolution.kind === "none") return;
  const { vat } = resolution;

  let enabled = await getEnabled();
  const replacer = new PriceReplacer(document, {
    enabled,
    approx: !vat.exact,
    netCartTotals: vat.netCartTotals,
    taxName: vat.taxName,
    rateFor: (el) => vat.byProduct.get(productIdFor(el) ?? -1) ?? vat.rate,
  });

  const render = () => {
    replacer.apply();
    ensureNote(document, noteText(vat, enabled), () => void setEnabled(!enabled));
  };

  // The site re-renders prices on its own (popups, currency changes); follow it.
  // Writes that change nothing cause no further mutations, so this settles.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }).observe(document.body, { subtree: true, childList: true, characterData: true });

  onEnabledChange((value) => {
    enabled = value;
    replacer.setEnabled(value);
    render();
  });

  render();
}

void main();
