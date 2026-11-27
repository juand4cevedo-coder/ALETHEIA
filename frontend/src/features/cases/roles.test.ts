import { describe, expect, it } from "vitest";

import { canOpenCases } from "./roles.ts";

describe("canOpenCases", () => {
  it("en una firma abren casos los abogados, no quien dirige el despacho", () => {
    expect(canOpenCases({ role: "owner", kind: "firm" })).toBe(false);
    expect(canOpenCases({ role: "lawyer", kind: "firm" })).toBe(true);
  });

  it("en una cuenta independiente el responsable es el abogado y abre casos", () => {
    expect(canOpenCases({ role: "owner", kind: "individual" })).toBe(true);
  });

  it("el administrador, el asistente y quien no tiene despacho no abren casos", () => {
    expect(canOpenCases({ role: "admin", kind: "firm" })).toBe(false);
    expect(canOpenCases({ role: "assistant", kind: "individual" })).toBe(false);
    expect(canOpenCases(null)).toBe(false);
  });
});
