import { describe, expect, it } from "vitest";

import { formatColombiaTime, formatRecentActivity } from "./dates.ts";

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

describe("Hace cuánto fue la última actividad", () => {
  const now = new Date("2026-11-10T19:00:00Z"); // 14:00 en Bogotá

  it("en el último minuto dice «hace un momento»", () => {
    expect(formatRecentActivity("2026-11-10T18:59:30Z", now)).toBe(
      "hace un momento",
    );
  });

  it("en la última hora cuenta los minutos", () => {
    expect(formatRecentActivity("2026-11-10T18:53:00Z", now)).toBe(
      "hace 7 min",
    );
  });

  it("más temprano el mismo día de Colombia dice «hoy» y la hora", () => {
    expect(formatRecentActivity("2026-11-10T14:12:00Z", now)).toBe(
      "hoy, 09:12",
    );
  });

  it("otro día muestra la fecha sin la hora", () => {
    // Las 02:00 UTC del 10 son las 21:00 del 9 en Bogotá: ya no es «hoy».
    expect(formatRecentActivity("2026-11-10T02:00:00Z", now)).toBe("9 de nov");
  });

  it("otro año agrega el año", () => {
    expect(formatRecentActivity("2025-12-31T15:00:00Z", now)).toBe(
      "31 de dic de 2025",
    );
  });
});
