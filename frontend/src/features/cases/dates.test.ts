import { describe, expect, it } from "vitest";

import { formatColombiaTime, formatRecentActivity } from "./dates.ts";

describe("Hora de Colombia", () => {
  it("muestra la medianoche de Bogotá para las 05:00 UTC, con el mes completo", () => {
    expect(formatColombiaTime("2026-01-01T05:00:00Z")).toBe(
      "1 de enero de 2026 a las 12:00 a. m.",
    );
  });

  it("con segundos aclara que es la hora de Colombia, sin «UTC»", () => {
    const text = formatColombiaTime("2026-01-01T05:00:09Z", { seconds: true });
    expect(text).toContain("12:00:09 a. m.");
    expect(text.endsWith("(hora de Colombia)")).toBe(true);
    expect(text).not.toContain("UTC");
  });

  it("sin segundos no lleva la aclaración", () => {
    expect(formatColombiaTime("2026-01-01T05:00:00Z")).not.toContain(
      "hora de Colombia",
    );
  });
});

describe("Hace cuánto fue la última actividad", () => {
  const now = new Date("2026-11-10T19:00:00Z"); // 2:00 p. m. en Bogotá

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
      "hoy a las 9:12 a. m.",
    );
  });

  it("otro día muestra la fecha sin la hora", () => {
    // Las 02:00 UTC del 10 son las 9:00 p. m. del 9 en Bogotá: ya no es «hoy».
    expect(formatRecentActivity("2026-11-10T02:00:00Z", now)).toBe(
      "9 de noviembre",
    );
  });

  it("otro año agrega el año", () => {
    expect(formatRecentActivity("2025-12-31T15:00:00Z", now)).toBe(
      "31 de diciembre de 2025",
    );
  });
});
