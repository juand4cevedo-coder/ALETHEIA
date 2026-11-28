import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog.tsx";

describe("ConfirmDialog", () => {
  it("pregunta con el diálogo del producto y confirma o cancela", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="¿Revocar este enlace?"
        confirmLabel="Revocar el enlace"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <p>Quien lo tenga ya no podrá descargar el archivo.</p>
      </ConfirmDialog>,
    );

    expect(
      screen.getByRole("dialog", { name: "¿Revocar este enlace?" }),
    ).toHaveTextContent("Quien lo tenga ya no podrá descargar el archivo.");
    await user.click(screen.getByRole("button", { name: "Revocar el enlace" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
