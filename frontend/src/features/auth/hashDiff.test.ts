import { describe, expect, it } from "vitest";

import { changedCharacters } from "./hashDiff.ts";

describe("Conteo de caracteres de la huella que cambiaron", () => {
  it("compara posición por posición", () => {
    expect(changedCharacters("abcd", "abcd")).toBe(0);
    expect(changedCharacters("abcd", "abce")).toBe(1);
    expect(changedCharacters("abcd", "dcba")).toBe(4);
  });

  it("cuenta todo como cambio cuando no había huella anterior", () => {
    expect(changedCharacters("", "abcd")).toBe(4);
  });
});
