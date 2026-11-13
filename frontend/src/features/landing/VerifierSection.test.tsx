import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifierSection } from "./VerifierSection.tsx";
import { digestFile, MAX_VERIFY_BYTES } from "./fileDigest.ts";

const ABC_HASH =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
function testFile() {
  const file = new File(["abc"], "documento.txt", { type: "text/plain" });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: async () => new TextEncoder().encode("abc").buffer,
  });
  return file;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Comprobación local de archivos", () => {
  it("calcula el vector SHA-256 conocido sin peticiones de red", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(await digestFile(testFile())).toBe(ABC_HASH);
    expect(request).not.toHaveBeenCalled();
  });
  it("rechaza el tamaño antes de leer el contenido", async () => {
    const file = testFile();
    Object.defineProperty(file, "size", { value: MAX_VERIFY_BYTES + 1 });
    const read = vi.spyOn(file, "arrayBuffer");
    await expect(digestFile(file)).rejects.toThrow("file-too-large");
    expect(read).not.toHaveBeenCalled();
  });
  it("compara una referencia en mayúsculas y retira la coincidencia al editarla", async () => {
    const user = userEvent.setup();
    render(<VerifierSection />);
    fireEvent.change(screen.getByLabelText("Archivo que desea comprobar"), {
      target: { files: [testFile()] },
    });
    const reference = screen.getByLabelText("Huella de referencia (opcional)");
    await user.type(reference, ABC_HASH.toUpperCase());
    await user.click(
      screen.getByRole("button", { name: "Calcular y comprobar" }),
    );
    expect(
      await screen.findByText("Las huellas coinciden"),
    ).toBeInTheDocument();
    await user.clear(reference);
    expect(screen.queryByText("Las huellas coinciden")).not.toBeInTheDocument();
    await user.type(reference, "0".repeat(64));
    expect(screen.getByText("Las huellas no coinciden")).toBeInTheDocument();
  });
  it("limpia el resultado al elegir otro archivo", async () => {
    const user = userEvent.setup();
    render(<VerifierSection />);
    const input = screen.getByLabelText("Archivo que desea comprobar");
    fireEvent.change(input, { target: { files: [testFile()] } });
    await user.click(
      screen.getByRole("button", { name: "Calcular y comprobar" }),
    );
    expect(await screen.findByText("Huella calculada")).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [testFile()] } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("bloquea un segundo cálculo mientras lee el archivo", async () => {
    const user = userEvent.setup();
    const file = new File(["x"], "pendiente.txt");
    Object.defineProperty(file, "arrayBuffer", {
      value: () => new Promise(() => {}),
    });
    render(<VerifierSection />);
    const input = screen.getByLabelText("Archivo que desea comprobar");
    fireEvent.change(input, { target: { files: [file] } });
    await user.click(
      screen.getByRole("button", { name: "Calcular y comprobar" }),
    );
    expect(
      screen.getByRole("button", { name: "Calculando la huella" }),
    ).toBeDisabled();
    expect(input).toBeDisabled();
  });
  it("explica un fallo de lectura sin mostrar una coincidencia", async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto.subtle, "digest").mockRejectedValue(
      new Error("no disponible"),
    );
    render(<VerifierSection />);
    fireEvent.change(screen.getByLabelText("Archivo que desea comprobar"), {
      target: { files: [testFile()] },
    });
    await user.click(
      screen.getByRole("button", { name: "Calcular y comprobar" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos leer el archivo",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("sin Web Crypto no ofrece una comprobación ficticia", () => {
    vi.stubGlobal("crypto", {});
    render(<VerifierSection />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Su navegador no permite calcular",
    );
    expect(
      screen.getByRole("button", { name: "Calcular y comprobar" }),
    ).toBeDisabled();
  });
});
