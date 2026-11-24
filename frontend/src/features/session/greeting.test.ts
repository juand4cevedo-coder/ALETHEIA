import { describe, expect, it } from "vitest";

import { greeting } from "./greeting.ts";

describe("Saludo", () => {
  it.each([
    ["2026-11-24T13:00:00Z", "Buenos días, Laura"], // 8:00 a. m. en Colombia
    ["2026-11-24T18:30:00Z", "Buenas tardes, Laura"], // 1:30 p. m.
    ["2026-11-25T01:00:00Z", "Buenas noches, Laura"], // 8:00 p. m.
    ["2026-11-24T08:00:00Z", "Buenas noches, Laura"], // 3:00 a. m.
  ])("a las %s UTC dice «%s»", (iso, expected) => {
    expect(greeting("Laura Gómez Pardo", new Date(iso))).toBe(expected);
  });

  it("sin nombre saluda igual", () => {
    expect(greeting("  ", new Date("2026-11-24T13:00:00Z"))).toBe(
      "Buenos días",
    );
  });
});
