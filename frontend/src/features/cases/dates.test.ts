import { describe, expect, it } from "vitest";

import { formatColombiaTime } from "./dates.ts";

describe("Hora de Colombia", () => {
  it("muestra la medianoche de Bogotá para las 05:00 UTC", () => {
    expect(formatColombiaTime("2026-01-01T05:00:00Z")).toContain("00:00");
  });

  it("con segundos agrega el sufijo fijo (UTC−5) con el signo menos de Unicode", () => {
    const text = formatColombiaTime("2026-01-01T05:00:09Z", { seconds: true });
    expect(text).toContain("00:00:09");
    expect(text.endsWith("(UTC−5)")).toBe(true);
  });

  it("sin segundos no lleva el sufijo", () => {
    expect(formatColombiaTime("2026-01-01T05:00:00Z")).not.toContain("UTC");
  });
});
