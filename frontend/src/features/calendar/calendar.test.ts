import { describe, expect, it } from "vitest";

import {
  addMonths,
  currentMonth,
  dayKey,
  dayLabel,
  gridRange,
  monthGrid,
  monthLabel,
  monthRange,
  timeLabel,
} from "./calendar.ts";

describe("calendario de plazos", () => {
  it("agrupa un plazo nocturno en su día de Colombia y no en el de UTC", () => {
    // 11:30 p. m. del 24 en Bogotá son las 04:30 del 25 en UTC.
    expect(dayKey("2026-11-25T04:30:00Z")).toBe("2026-11-24");
    expect(timeLabel("2026-11-24T20:00:00Z")).toMatch(/3:00/);
  });

  it("pide el mes completo con zona horaria y fin exclusivo", () => {
    expect(monthRange({ year: 2026, month: 11 })).toEqual({
      from: "2026-11-01T00:00:00-05:00",
      to: "2026-12-01T00:00:00-05:00",
    });
    expect(monthRange({ year: 2026, month: 12 }).to).toBe(
      "2027-01-01T00:00:00-05:00",
    );
  });

  it("pide toda la cuadrícula visible, con los días de los meses vecinos", () => {
    // Noviembre de 2026 se dibuja del 26 de octubre al 6 de diciembre.
    expect(gridRange({ year: 2026, month: 11 })).toEqual({
      from: "2026-10-26T00:00:00-05:00",
      to: "2026-12-07T00:00:00-05:00",
    });
    // Una cuadrícula de seis semanas sigue dentro del máximo de 62 días de la API.
    const range = gridRange({ year: 2026, month: 8 });
    const days =
      (Date.parse(range.to) - Date.parse(range.from)) / (24 * 60 * 60 * 1000);
    expect(days).toBeLessThanOrEqual(42);
  });

  it("avanza y retrocede entre años", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
    expect(currentMonth(new Date("2026-11-22T20:00:00Z"))).toEqual({
      year: 2026,
      month: 11,
    });
  });

  it("arma semanas completas de lunes a domingo", () => {
    // Noviembre de 2026 empieza en domingo: la primera fila trae seis días de octubre.
    const weeks = monthGrid({ year: 2026, month: 11 });
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]![0]!.key).toBe("2026-10-26");
    expect(weeks[0]![6]).toMatchObject({ key: "2026-11-01", inMonth: true });
    expect(weeks.flat().filter((cell) => cell.inMonth)).toHaveLength(30);
    expect(weeks.at(-1)!.at(-1)!.key).toBe("2026-12-06");
  });

  it("escribe el mes y el día en español con mayúscula inicial", () => {
    expect(monthLabel({ year: 2026, month: 11 })).toBe("Noviembre de 2026");
    expect(dayLabel("2026-11-24")).toBe("Martes, 24 de noviembre");
  });
});
