import { describe, expect, it } from "vitest";

import {
  FILING_PARTS,
  formatFilingNumber,
  isValidFilingNumber,
  normalizeFilingNumber,
  splitFilingNumber,
} from "./filingNumber.ts";

const DIGITS = "11001310500320260014300";

describe("Número de radicación", () => {
  it("quita guiones, puntos y espacios", () => {
    expect(normalizeFilingNumber("11001-31-05-003-2026-00143-00")).toBe(DIGITS);
    expect(normalizeFilingNumber("11001.31.05.003.2026.00143.00")).toBe(DIGITS);
    expect(normalizeFilingNumber(" 11001 31 05 003 2026 00143 00 ")).toBe(
      DIGITS,
    );
  });

  it("solo es válido con exactamente 23 dígitos", () => {
    expect(isValidFilingNumber(DIGITS.slice(0, 22))).toBe(false);
    expect(isValidFilingNumber(DIGITS)).toBe(true);
    expect(isValidFilingNumber(`${DIGITS}0`)).toBe(false);
    expect(isValidFilingNumber("1100131050032026001430A")).toBe(false);
  });

  it("describe las ocho partes y suman 23 dígitos", () => {
    expect(FILING_PARTS.map((part) => part.label)).toEqual([
      "Depto.",
      "Ciudad",
      "Entidad",
      "Especialidad",
      "Despacho",
      "Año",
      "Consec.",
      "Recurso",
    ]);
    expect(FILING_PARTS.reduce((sum, part) => sum + part.length, 0)).toBe(23);
  });

  it("divide el radicado en sus ocho partes", () => {
    expect(splitFilingNumber(DIGITS)).toEqual([
      "11",
      "001",
      "31",
      "05",
      "003",
      "2026",
      "00143",
      "00",
    ]);
  });

  it("lo formatea con departamento y ciudad unidos", () => {
    expect(formatFilingNumber(DIGITS)).toBe("11001 31 05 003 2026 00143 00");
  });
});
