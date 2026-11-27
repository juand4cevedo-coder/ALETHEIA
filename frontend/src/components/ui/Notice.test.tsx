import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Notice } from "./Notice.tsx";

describe("Notice que se puede cerrar", () => {
  it("con dismissId se cierra y no vuelve a mostrarse en este navegador", async () => {
    const user = userEvent.setup();
    const first = render(
      <Notice tone="info" dismissId="prueba-aviso">
        <p>Solo la persona responsable puede pagar.</p>
      </Notice>,
    );

    await user.click(screen.getByRole("button", { name: "Cerrar este aviso" }));

    expect(
      screen.queryByText("Solo la persona responsable puede pagar."),
    ).not.toBeInTheDocument();
    first.unmount();
    render(
      <Notice tone="info" dismissId="prueba-aviso">
        <p>Solo la persona responsable puede pagar.</p>
      </Notice>,
    );
    expect(
      screen.queryByText("Solo la persona responsable puede pagar."),
    ).not.toBeInTheDocument();
  });

  it("sin dismissId no ofrece cerrar", () => {
    render(
      <Notice tone="error">
        <p>No pudimos guardar.</p>
      </Notice>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
