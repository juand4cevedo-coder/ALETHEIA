import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { seriousAxeViolations } from "../../test/axe.ts";
import { Field } from "./Field.tsx";

describe("Campo de texto", () => {
  it("la etiqueta va encima del campo y no hace de texto de ejemplo", () => {
    render(<Field label="Correo" type="email" />);

    const input = screen.getByLabelText("Correo");
    const label = screen.getByText("Correo");
    expect(label.tagName).toBe("LABEL");
    expect(label).toBeVisible();
    // La etiqueta precede al campo en el documento: se lee y se ve antes.
    expect(
      label.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(input).not.toHaveAttribute("placeholder");
  });

  it("la ayuda va debajo y se lee junto con el campo", () => {
    render(<Field label="Despacho" help="Por ejemplo, Juzgado 3 Laboral." />);

    const input = screen.getByLabelText("Despacho");
    expect(input).toHaveAccessibleDescription(
      "Por ejemplo, Juzgado 3 Laboral.",
    );
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("el error reemplaza la ayuda y queda asociado al campo", () => {
    render(
      <Field
        label="Despacho"
        help="Por ejemplo, Juzgado 3 Laboral."
        error="Escriba el despacho con menos de 160 caracteres."
      />,
    );

    const input = screen.getByLabelText("Despacho");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Escriba el despacho con menos de 160 caracteres.",
    );
    expect(
      screen.queryByText("Por ejemplo, Juzgado 3 Laboral."),
    ).not.toBeInTheDocument();
  });

  it("con foco, un campo con error sigue marcado y describe el error", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Correo" type="email" error="Escriba un correo válido." />,
    );

    const input = screen.getByLabelText("Correo");
    await user.click(input);
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Escriba un correo válido.");
  });

  it("la ayuda dinámica se suma a la descripción del campo", () => {
    render(
      <Field label="Contraseña" type="password" describedBy="medidor">
        <p id="medidor">Fuerza: media</p>
      </Field>,
    );

    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription(
      "Fuerza: media",
    );
  });

  it("la contraseña se puede mostrar y volver a ocultar", async () => {
    const user = userEvent.setup();
    render(<Field label="Contraseña" type="password" />);

    const input = screen.getByLabelText("Contraseña");
    const toggle = screen.getByRole("button", {
      name: "Mostrar la contraseña",
    });
    expect(input).toHaveAttribute("type", "password");

    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("pasa axe con ayuda y con error", async () => {
    const { container } = render(
      <form>
        <Field label="Título del caso" help="Así lo verá su equipo." />
        <Field label="Correo" type="email" error="Escriba un correo válido." />
      </form>,
    );

    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
