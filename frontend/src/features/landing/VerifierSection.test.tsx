import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifierSection } from "./VerifierSection.tsx";

const ABC_HASH =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function testFile() {
  return new File(["abc"], "documento.txt", { type: "text/plain" });
}

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  static digest = ABC_HASH;
  static fails = false;

  postMessage(_value: unknown) {
    queueMicrotask(() => {
      if (FakeWorker.fails) {
        this.onmessage?.({ data: { type: "error" } } as MessageEvent);
        return;
      }
      this.onmessage?.({
        data: { type: "complete", digest: FakeWorker.digest },
      } as MessageEvent);
    });
  }

  terminate() {}
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  FakeWorker.digest = ABC_HASH;
  FakeWorker.fails = false;
});

describe("Comprobación local de archivos", () => {
  it("compara una referencia en mayúsculas y retira la coincidencia al editarla", async () => {
    vi.stubGlobal("Worker", FakeWorker);
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
    vi.stubGlobal("Worker", FakeWorker);
    const user = userEvent.setup();
    render(<VerifierSection />);
    const fileInput = screen.getByLabelText("Archivo que desea comprobar");
    fireEvent.change(fileInput, { target: { files: [testFile()] } });
    await user.click(
      screen.getByRole("button", { name: "Calcular y comprobar" }),
    );
    expect(await screen.findByText("Huella calculada")).toBeInTheDocument();
    fireEvent.change(fileInput, { target: { files: [testFile()] } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("explica un fallo de lectura sin mostrar una coincidencia", async () => {
    FakeWorker.fails = true;
    vi.stubGlobal("Worker", FakeWorker);
    const user = userEvent.setup();
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
  it("sin Web Worker no ofrece una comprobación ficticia", () => {
    vi.stubGlobal("Worker", undefined);
    render(<VerifierSection />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Su navegador no permite calcular",
    );
    expect(
      screen.getByRole("button", { name: "Calcular y comprobar" }),
    ).toBeDisabled();
  });
});
