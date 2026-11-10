import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HashDemo, SAMPLE_HASH, SAMPLE_TEXT } from "./HashDemo.tsx";
import { sha256Hex } from "./useSha256.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Demostración de la huella", () => {
  it("la huella registrada corresponde al texto de ejemplo", async () => {
    // Se calcula con Web Crypto (sin node:crypto) para que tsc -b no exija tipos de Node.
    expect(SAMPLE_HASH).toBe(await sha256Hex(SAMPLE_TEXT));
  });

  it("al montar muestra el texto de ejemplo y «Coincide»", async () => {
    render(<HashDemo />);
    expect(
      screen.getByRole("textbox", { name: "Texto de ejemplo" }),
    ).toHaveValue(SAMPLE_TEXT);
    expect(await screen.findByText("Coincide")).toBeInTheDocument();
  });

  it("al cambiar una palabra avisa que no coincide", async () => {
    const user = userEvent.setup();
    render(<HashDemo />);
    const box = screen.getByRole("textbox", { name: "Texto de ejemplo" });

    await user.clear(box);
    await user.type(box, SAMPLE_TEXT.replace("lunes", "martes"));

    expect(await screen.findByText("No coincide")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No coincide");
  });

  it("«Restaurar el texto» vuelve a la huella registrada", async () => {
    const user = userEvent.setup();
    render(<HashDemo />);
    const box = screen.getByRole("textbox", { name: "Texto de ejemplo" });

    await user.type(box, "!");
    expect(await screen.findByText("No coincide")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Restaurar el texto" }),
    );
    expect(await screen.findByText("Coincide")).toBeInTheDocument();
    expect(box).toHaveValue(SAMPLE_TEXT);
  });

  it("con el texto vacío muestra la huella del texto vacío", async () => {
    const user = userEvent.setup();
    render(<HashDemo />);

    await user.clear(screen.getByRole("textbox", { name: "Texto de ejemplo" }));

    expect(await screen.findByText("No coincide")).toBeInTheDocument();
    expect(screen.getByText(/e3b0c442/)).toBeInTheDocument();
  });

  it("sin crypto.subtle conserva la huella registrada y lo avisa", () => {
    vi.stubGlobal("crypto", {});
    render(<HashDemo />);

    expect(
      screen.getByText(
        "Su navegador no permite recalcular la huella en esta página.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/2423c674/).length).toBeGreaterThan(0);
  });
});
