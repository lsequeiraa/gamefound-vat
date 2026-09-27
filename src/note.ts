import { formatRate } from "./price";
import type { Source, Vat } from "./rate";
import { TABLE_CHECKED } from "./vat-rates";

const BAR = '[data-qa="delivery-to:LocationBar"]';
const CLASS = "gfvat-note";

const SOURCE_TEXT: Record<Source, string> = {
  pledge: "from your pledge on this project",
  orders: "estimated from your past Gamefound orders",
  table: `estimated from the standard rate (checked ${TABLE_CHECKED})`,
};

export interface NoteText {
  text: string;
  title: string;
}

export function noteText(vat: Vat, enabled: boolean): NoteText {
  const rate = `${vat.exact ? "" : "≈"}${formatRate(vat.rate)}`;
  const where = `${formatRate(vat.rate)} ${vat.taxName} for ${vat.locationName}, ${SOURCE_TEXT[vat.source]}.`;
  return enabled
    ? { text: `prices incl. ${rate} ${vat.taxName}`, title: `VAT Included for Gamefound: ${where} Click to show the original prices.` }
    : { text: `prices excl. ${vat.taxName}`, title: `VAT Included for Gamefound: ${where} Click to include it in the prices.` };
}

/** Keeps a short status note in the "Delivery to" bar; clicking it toggles the tax. */
export function ensureNote(doc: Document, content: NoteText, onClick: () => void): void {
  const bar = doc.querySelector(BAR);
  let note = doc.querySelector<HTMLButtonElement>(`.${CLASS}`);
  if (!bar) {
    note?.remove();
    return;
  }
  if (!note || note.parentElement !== bar) {
    note?.remove();
    ensureStyle(doc);
    note = doc.createElement("button");
    note.type = "button";
    note.className = CLASS;
    note.addEventListener("click", onClick);
    bar.append(note);
  }
  if (note.textContent !== content.text) note.textContent = content.text;
  if (note.title !== content.title) note.title = content.title;
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(`${CLASS}-style`)) return;
  const style = doc.createElement("style");
  style.id = `${CLASS}-style`;
  style.textContent = `
.${CLASS} { all: unset; margin-left: .5em; font: inherit; color: inherit; opacity: .75; cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.${CLASS}::before { content: "·"; display: inline-block; margin-right: .5em; }
.${CLASS}:hover, .${CLASS}:focus-visible { opacity: 1; }
`;
  (doc.head ?? doc.documentElement).append(style);
}
