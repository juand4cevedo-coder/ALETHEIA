import { describe, expect, it } from "vitest";

import { logotipo } from "../../brand/geometria.ts";
import { ANCHO, TRAZOS } from "./Logotipo.tsx";

describe("Logotipo", () => {
  it("usa los mismos trazos que la geometría de la marca", () => {
    const { d, ancho } = logotipo();
    expect(TRAZOS).toBe(d);
    expect(ANCHO).toBe(ancho);
  });
});
