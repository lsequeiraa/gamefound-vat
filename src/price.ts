export interface ParsedPrice {
  /** Text before the number, e.g. the currency symbol. */
  before: string;
  /** Text after the number. */
  after: string;
  value: number;
  decimals: number;
  decimalSep: string;
  groupSep: string;
}

const NUMBER = /\d(?:[\d.,'\u00a0\u202f ]*\d)?/;

/** Parses the first number in a displayed price such as "€1,234.50" or "1.234,50 zł". */
export function parsePrice(text: string): ParsedPrice | null {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const raw = match[0];

  let decimalSep = "";
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  const last = Math.max(lastDot, lastComma);
  if (last >= 0) {
    const sep = raw[last]!;
    const tail = raw.length - last - 1;
    const both = lastDot >= 0 && lastComma >= 0;
    const once = raw.indexOf(sep) === last;
    // "1,234.50" and "1.234,50" have both kinds; a lone separator with one or
    // two digits after it ("436.90") is a decimal point, three digits ("1,234") is grouping.
    if (both || (once && tail <= 2)) decimalSep = sep;
  }

  const [intPart, fracPart = ""] = decimalSep ? [raw.slice(0, raw.lastIndexOf(decimalSep)), raw.slice(raw.lastIndexOf(decimalSep) + 1)] : [raw];
  const groupSep = /[^\d]/.exec(intPart!)?.[0] ?? (decimalSep === "," ? "." : ",");
  const value = Number(`${intPart!.replace(/\D/g, "")}.${fracPart || "0"}`);
  if (!Number.isFinite(value)) return null;

  return {
    before: text.slice(0, match.index),
    after: text.slice(match.index + raw.length),
    value,
    decimals: fracPart.length,
    decimalSep,
    groupSep,
  };
}

export function formatPrice(p: ParsedPrice, value: number): string {
  const [int, frac = ""] = value.toFixed(p.decimals).split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, p.groupSep);
  return `${p.before}${grouped}${frac ? p.decimalSep + frac : ""}${p.after}`;
}

/** Adds VAT and rounds half up to the price's own number of decimals. */
export function addVat(value: number, rate: number, decimals: number): number {
  const scale = 10 ** decimals;
  const minor = Math.round(value * scale);
  // Integer arithmetic until the last division keeps x.5 results exact.
  const basisPoints = Math.round(rate * 10000);
  return Math.round((minor * (10000 + basisPoints)) / 10000) / scale;
}

/** "€436.90" at 23% becomes "€537.39"; with `approx` it becomes "≈€537.39". */
export function withVat(text: string, rate: number, approx = false): string {
  const p = parsePrice(text);
  if (!p) return text;
  const out = formatPrice(p, addVat(p.value, rate, p.decimals));
  return approx ? out.replace(/^(\s*)/, "$1≈") : out;
}

/** 0.23 → "23%", 0.255 → "25.5%". */
export function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`;
}
