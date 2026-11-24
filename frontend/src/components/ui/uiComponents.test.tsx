import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { seriousAxeViolations } from "../../test/axe.ts";
import { BrandMark } from "./BrandMark.tsx";
import { ChoiceCards } from "./ChoiceCards.tsx";
import { Meter } from "./Meter.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";

describe("Medidor", () => {
  it("expone el valor como medidor accesible y lo limita entre 0 y 100", () => {
    render(<Meter label="Del tope usado" value={140} valueText="140 %" />);
    const meter = screen.getByRole("meter", { name: "Del tope usado" });
    expect(meter).toHaveAttribute("aria-valuenow", "100");
    expect(meter).toHaveAttribute("aria-valuetext", "140 %");
    expect(screen.getByText("140 %")).toBeInTheDocument();
  });
});

describe("Opciones en tarjeta", () => {
  function Example() {
    const [value, setValue] = useState<"monthly" | "annual">("monthly");
    return (
      <ChoiceCards
        legend="Forma de pago"
        value={value}
        onChange={setValue}
        options={[
          { value: "monthly", label: "Mensual", description: "$29.900 al mes" },
          { value: "annual", label: "Anual", description: "$299.000 al año" },
        ]}
      />
    );
  }

  it("es un grupo de radios con su leyenda y responde a las flechas", async () => {
    const user = userEvent.setup();
    const { container } = render(<Example />);
    expect(
      screen.getByRole("group", { name: "Forma de pago" }),
    ).toBeInTheDocument();
    const monthly = screen.getByRole("radio", { name: /Mensual/ });
    expect(monthly).toBeChecked();
    await user.click(monthly);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /Anual/ })).toBeChecked();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});

describe("Control segmentado", () => {
  it("cambia de vista con un clic", async () => {
    function Example() {
      const [view, setView] = useState<"open" | "closed">("open");
      return (
        <>
          <SegmentedControl
            label="Mostrar"
            value={view}
            onChange={setView}
            options={[
              { value: "open", label: "Abiertas" },
              { value: "closed", label: "Resueltas" },
            ]}
          />
          <p>{view}</p>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("radio", { name: "Resueltas" }));
    expect(screen.getByText("closed")).toBeInTheDocument();
  });
});

describe("Símbolo de la marca", () => {
  it("es decorativo y respeta el tamaño pedido", () => {
    const { container } = render(<BrandMark size={32} />);
    const image = container.querySelector("img")!;
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("width", "32");
    expect(image).toHaveAttribute("src", "/brand/symbol-dark.svg");
  });
});
