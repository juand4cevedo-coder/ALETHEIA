import { describe, expect, it } from "vitest";

import { buildIcs, type IcsTask } from "./ics.ts";

const NOW = new Date("2026-11-22T12:00:00Z");

function task(overrides: Partial<IcsTask> = {}): IcsTask {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8060",
    title: "Radicar memorial",
    description: null,
    due_at: "2026-11-24T20:00:00Z",
    case_title: "Sucesión López",
    status: "pending",
    priority: "high",
    ...overrides,
  };
}

describe("archivo de calendario", () => {
  it("no genera nada si ningún plazo tiene fecha", () => {
    expect(buildIcs([], NOW)).toBeNull();
    expect(buildIcs([task({ due_at: null })], NOW)).toBeNull();
    expect(buildIcs([task({ status: "canceled" })], NOW)).toBeNull();
  });

  it("escribe un evento válido con fecha en UTC, prioridad y aviso", () => {
    const ics = buildIcs([task()], NOW)!;
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("DTSTART:20261124T200000Z");
    expect(lines).toContain("DTEND:20261124T201500Z");
    expect(lines).toContain("DTSTAMP:20261122T120000Z");
    expect(lines).toContain("SUMMARY:Radicar memorial");
    expect(lines).toContain("PRIORITY:3");
    expect(lines).toContain(
      "UID:01890a5d-ac96-774b-bcce-b302099a8060@aletheia.sbs",
    );
    expect(lines).toContain("TRIGGER:-PT1H");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapa comas, puntos y comas, barras y saltos de línea", () => {
    const ics = buildIcs(
      [
        task({
          title: "Revisar; ajustar, enviar",
          description: "Línea 1\nLínea 2",
        }),
      ],
      NOW,
    )!;
    expect(ics).toContain("SUMMARY:Revisar\\; ajustar\\, enviar");
    expect(ics).toContain("Línea 1\\nLínea 2");
  });

  it("parte las líneas largas en 75 bytes y las continúa con un espacio", () => {
    const ics = buildIcs([task({ title: "A".repeat(200) })], NOW)!;
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics).toMatch(/\r\n A+/);
  });
});
