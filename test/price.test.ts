import { describe, expect, test } from "bun:test";
import { addVat, formatRate, parsePrice, withVat } from "../src/price";

describe("parsePrice", () => {
  test.each([
    ["€436.90", 436.9, 2, ".", ","],
    ["$1,234.50", 1234.5, 2, ".", ","],
    ["1.234,50 zł", 1234.5, 2, ",", "."],
    ["1\u00a0234,50 kr", 1234.5, 2, ",", "\u00a0"],
    ["$15,656,939", 15656939, 0, "", ","],
    ["\tkr.26.02", 26.02, 2, ".", ","],
  ])("%p", (text, value, decimals, decimalSep, groupSep) => {
    expect(parsePrice(text)).toMatchObject({ value, decimals, decimalSep, groupSep });
  });

  test("keeps the text around the number", () => {
    expect(parsePrice(" €26.02 ")).toMatchObject({ before: " €", after: " " });
  });

  test("no number", () => {
    expect(parsePrice("+tax")).toBeNull();
  });
});

describe("addVat", () => {
  test("matches the gross prices Gamefound charged in a real cart", () => {
    expect(addVat(290, 0.23, 2)).toBe(356.7);
    expect(addVat(37, 0.23, 2)).toBe(45.51);
    expect(addVat(43, 0.23, 2)).toBe(52.89);
    expect(addVat(23, 0.23, 2)).toBe(28.29);
  });

  test("rounds half up without float drift", () => {
    expect(addVat(0.5, 0.23, 2)).toBe(0.62); // 0.615
    expect(addVat(436.9, 0.23, 2)).toBe(537.39); // 537.387
    expect(addVat(10, 0.255, 2)).toBe(12.55);
  });
});

describe("withVat", () => {
  test("replaces the number in place", () => {
    expect(withVat("€436.90", 0.23)).toBe("€537.39");
    expect(withVat("€912.00", 0.23)).toBe("€1,121.76");
    expect(withVat("1.234,50 zł", 0.23)).toBe("1.518,44 zł");
  });

  test("marks estimates", () => {
    expect(withVat("€436.90", 0.23, true)).toBe("≈€537.39");
    expect(withVat(" €1.00", 0.23, true)).toBe(" ≈€1.23");
  });

  test("leaves text without a number alone", () => {
    expect(withVat("free", 0.23)).toBe("free");
  });
});

test("formatRate", () => {
  expect(formatRate(0.23)).toBe("23%");
  expect(formatRate(0.255)).toBe("25.5%");
  expect(formatRate(0)).toBe("0%");
});
