import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { FileDropzone } from "./FileDropzone.tsx";

function renderZone(progress: number | null = null) {
  return render(
    <form>
      <label htmlFor="archivo">Archivo</label>
      <FileDropzone id="archivo" name="archivo" required progress={progress} />
    </form>,
  );
}

it("muestra el archivo elegido con su tamaño y deja quitarlo", async () => {
  const user = userEvent.setup();
  renderZone();
  const input = screen.getByLabelText("Archivo", { selector: "input" });
  expect(screen.getByText("Arrastre un archivo aquí")).toBeInTheDocument();

  const file = new File(["contenido de prueba"], "acta.txt", {
    type: "text/plain",
  });
  await user.upload(input, file);
  expect(screen.getByText("acta.txt")).toBeInTheDocument();
  expect(screen.getByText("19 bytes")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Quitar el archivo" }));
  expect(screen.getByText("Arrastre un archivo aquí")).toBeInTheDocument();
  expect(input).toHaveValue("");
});

it("vuelve a su estado inicial cuando el formulario se reinicia", async () => {
  const user = userEvent.setup();
  const { container } = renderZone();
  const input = screen.getByLabelText("Archivo", { selector: "input" });
  await user.upload(input, new File(["x"], "foto.png", { type: "image/png" }));
  expect(screen.getByText("foto.png")).toBeInTheDocument();

  container.querySelector("form")!.reset();
  expect(await screen.findByText("Arrastre un archivo aquí")).toBeVisible();
});

it("muestra el avance de la subida", () => {
  renderZone(42);
  expect(
    screen.getByRole("progressbar", { name: "Avance de la subida" }),
  ).toHaveAttribute("aria-valuenow", "42");
});
