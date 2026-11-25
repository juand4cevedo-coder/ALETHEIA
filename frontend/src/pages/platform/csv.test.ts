import { describe, expect, it } from "vitest";

import { toCsv } from "./csv.ts";

describe("Exportación a CSV", () => {
  it("usa punto y coma y comillas en cada celda, con saltos de Windows", () => {
    expect(toCsv(["Despacho", "Personas"], [["Ruiz; Asociados", "3"]])).toBe(
      '"Despacho";"Personas"\r\n"Ruiz; Asociados";"3"',
    );
  });

  it("duplica las comillas internas", () => {
    expect(toCsv(["Nombre"], [['El "mejor" despacho']])).toBe(
      '"Nombre"\r\n"El ""mejor"" despacho"',
    );
  });

  it.each(["=SUMA(A1)", "+57 300", "-1", "@usuario"])(
    "neutraliza %s para que la hoja de cálculo no lo ejecute",
    (value) => {
      expect(toCsv(["Celda"], [[value]])).toBe(`"Celda"\r\n"'${value}"`);
    },
  );
});
