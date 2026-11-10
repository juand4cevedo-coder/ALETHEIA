import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { seriousAxeViolations } from "../../test/axe.ts";
import { FilingNumber } from "./FilingNumber.tsx";

const DIGITS = "11001310500320260014300";

describe("Número de radicación (componente)", () => {
  it("lo muestra por bloques, en monoespaciada y sin traducir", () => {
    render(<FilingNumber digits={DIGITS} />);
    const value = screen.getByText("11001 31 05 003 2026 00143 00");
    expect(value).toHaveAttribute("translate", "no");
  });

  it("con desglose muestra las ocho etiquetas y pasa axe", async () => {
    const { container } = render(<FilingNumber digits={DIGITS} breakdown />);
    for (const label of [
      "Depto.",
      "Ciudad",
      "Entidad",
      "Especialidad",
      "Despacho",
      "Año",
      "Consec.",
      "Recurso",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
