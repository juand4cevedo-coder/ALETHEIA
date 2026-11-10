import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HashDemo, SAMPLE_HASH, SAMPLE_TEXT } from "./HashDemo.tsx";
import { sha256Hex } from "./useSha256.ts";

afterEach(() => {
  vi.restoreAllMocks();
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
    await user.paste(SAMPLE_TEXT.replace("lunes", "martes"));

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

  it("sin crypto.subtle conserva la huella registrada y lo avisa", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("crypto", {});
    render(<HashDemo />);
    const notice =
      "Su navegador no permite recalcular la huella en esta página.";

    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.getAllByText(/2423c674/).length).toBeGreaterThan(0);

    await user.type(
      screen.getByRole("textbox", { name: "Texto de ejemplo" }),
      "!",
    );
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.queryByText("Coincide")).not.toBeInTheDocument();
  });

  it("si crypto.subtle.digest falla, avisa y no da por coincidente el texto editado", async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto.subtle, "digest").mockRejectedValue(new Error("x"));
    render(<HashDemo />);

    await user.type(
      screen.getByRole("textbox", { name: "Texto de ejemplo" }),
      "!",
    );

    expect(
      await screen.findByText(
        "Su navegador no permite recalcular la huella en esta página.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Coincide")).not.toBeInTheDocument();
  });

  it("al editar el texto marca los caracteres distintos solo en la huella actual", async () => {
    const user = userEvent.setup();
    render(<HashDemo />);

    await user.type(
      screen.getByRole("textbox", { name: "Texto de ejemplo" }),
      "!",
    );
    await screen.findByText("No coincide");

    const rowOf = (name: string) =>
      screen.getByText(name).closest("div") as HTMLElement;
    expect(
      rowOf("Huella actual").querySelectorAll('[class*="changed"]').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      rowOf("Huella registrada").querySelectorAll('[class*="changed"]').length,
    ).toBe(0);
  });
});
