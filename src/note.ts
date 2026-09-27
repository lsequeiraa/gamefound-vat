import { formatRate } from "./price";
import type { Resolution, Source } from "./rate";
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
  clickable: boolean;
}

export function noteText(res: Resolution, enabled: boolean): NoteText | null {
  if (res.kind === "none") {
    if (res.reason === "no-tax") return null;
    return {
      text: "prices excl. VAT (rate unknown)",
      title: `Gamefound VAT: no VAT rate known for ${res.locationName || "this location"} on this project yet.`,
      clickable: false,
    };
  }
  const { vat } = res;
  const rate = `${vat.exact ? "" : "≈"}${formatRate(vat.rate)}`;
  const where = `${formatRate(vat.rate)} VAT for ${vat.locationName}, ${SOURCE_TEXT[vat.source]}.`;
  return enabled
    ? { text: `prices incl. ${rate} VAT`, title: `Gamefound VAT: ${where} Click to show the original prices.`, clickable: true }
    : { text: "prices excl. VAT", title: `Gamefound VAT: ${where} Click to include it in the prices.`, clickable: true };
}

/** Keeps a short status note in the "Delivery to" bar; clicking it toggles VAT. */
export function ensureNote(doc: Document, content: NoteText | null, onClick: () => void): void {
  const bar = doc.querySelector(BAR);
  let note = doc.querySelector<HTMLButtonElement>(`.${CLASS}`);
  if (!bar || !content) {
    note?.remove();
    return;
  }
  if (!note || note.parentElement !== bar) {
    note?.remove();
    ensureStyle(doc);
    note = doc.createElement("button");
    note.type = "button";
    note.className = CLASS;
    note.addEventListener("click", (event) => {
      if ((event.currentTarget as HTMLElement).dataset.clickable === "true") onClick();
    });
    bar.append(note);
  }
  if (note.textContent !== content.text) note.textContent = content.text;
  if (note.title !== content.title) note.title = content.title;
  note.dataset.clickable = String(content.clickable);
  note.tabIndex = content.clickable ? 0 : -1;
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(`${CLASS}-style`)) return;
  const style = doc.createElement("style");
  style.id = `${CLASS}-style`;
  style.textContent = `
.${CLASS} { all: unset; margin-left: .5em; font: inherit; color: inherit; opacity: .75; }
.${CLASS}::before { content: "·"; display: inline-block; margin-right: .5em; }
.${CLASS}[data-clickable="true"] { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.${CLASS}[data-clickable="true"]:hover, .${CLASS}:focus-visible { opacity: 1; }
`;
  (doc.head ?? doc.documentElement).append(style);
}
