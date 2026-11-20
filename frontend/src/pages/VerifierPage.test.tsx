import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { seriousAxeViolations } from "../test/axe.ts";
import { renderRoute } from "../test/render.tsx";

const id = "01890a5d-ac96-774b-bcce-b302099a8060";
const reference = "a".repeat(64);
const manifest = {
  format: "aletheia-preservation-manifest",
  format_version: 1,
  scope: "file-integrity",
  export_id: "01890a5d-ac96-774b-bcce-b302099a8070",
  case_id: "01890a5d-ac96-774b-bcce-b302099a8058",
  generated_at: "2026-11-16T18:00:00.000000Z",
  custody: {
    head_seq: 1,
    head_sha256: "a".repeat(64),
    events_path: "custody/events.json",
    anchor_token_path: null,
  },
  evidences: [
    {
      id,
      original_filename: "archivo.txt",
      path: `files/${id}`,
      sha256: reference,
      size_bytes: 3,
      tsa_status: "pending",
      tsa_token_path: null,
    },
  ],
};

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  static digest = reference;

  postMessage(_value: unknown) {
    queueMicrotask(() => {
      this.onmessage?.({
        data: { type: "complete", digest: FakeWorker.digest },
      } as MessageEvent);
    });
  }

  terminate() {}
}

afterEach(() => vi.unstubAllGlobals());

it("compara huellas localmente y muestra ambas cuando difieren", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Worker", FakeWorker);
  const user = userEvent.setup();
  const { container } = await renderRoute("/verificador");
  expect(await seriousAxeViolations(container)).toEqual([]);

  const inputs = screen.getAllByLabelText(
    /Manifiesto de preservación|Archivo a comprobar/,
  );
  const manifestFile = new File([JSON.stringify(manifest)], "manifest.json", {
    type: "application/json",
  });
  Object.defineProperty(manifestFile, "text", {
    value: () => Promise.resolve(JSON.stringify(manifest)),
  });
  await user.upload(inputs[0], manifestFile);
  await user.upload(inputs[1], new File(["abc"], "archivo.txt"));
  await user.click(screen.getByRole("button", { name: "Comparar huellas" }));
  expect(
    await screen.findByRole("heading", { name: "Las huellas coinciden" }),
  ).toBeInTheDocument();

  FakeWorker.digest = "b".repeat(64);
  await user.click(screen.getByRole("button", { name: "Comparar huellas" }));
  expect(
    await screen.findByRole("heading", { name: "Las huellas no coinciden" }),
  ).toBeInTheDocument();
  expect(screen.getByText(reference)).toBeInTheDocument();
  expect(screen.getByText("b".repeat(64))).toBeInTheDocument();
  await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
});

it("rechaza un manifiesto mal formado sin comenzar el cálculo", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const user = userEvent.setup();
  await renderRoute("/verificador");
  const file = new File(["{"], "manifest.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve("{") });
  await user.upload(screen.getByLabelText(/Manifiesto de preservación/), file);
  expect(await screen.findByRole("alert")).toHaveTextContent("JSON válido");
  expect(
    screen.getByRole("button", { name: "Comparar huellas" }),
  ).toBeDisabled();
});

it("ignora el resultado de una lectura anterior tras cambiar el manifiesto", async () => {
  const user = userEvent.setup();
  await renderRoute("/verificador");
  const input = screen.getByLabelText(/Manifiesto de preservación/);
  const previous = new File(["{"], "anterior.json", {
    type: "application/json",
  });
  let completePrevious!: (text: string) => void;
  const pending = new Promise<string>((resolve) => {
    completePrevious = resolve;
  });
  Object.defineProperty(previous, "text", { value: () => pending });
  const currentText = JSON.stringify(manifest);
  const current = new File([currentText], "actual.json", {
    type: "application/json",
  });
  Object.defineProperty(current, "text", {
    value: () => Promise.resolve(currentText),
  });

  await user.upload(input, previous);
  await user.upload(input, current);
  expect(await screen.findByText(/registrados en el manifiesto/)).toBeVisible();
  await act(async () => completePrevious("{"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("permite reintentar si el navegador no inicia el cálculo", async () => {
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        throw new Error("No se pudo iniciar el proceso local");
      }
    },
  );
  const user = userEvent.setup();
  await renderRoute("/verificador");
  const text = JSON.stringify(manifest);
  const chosen = new File([text], "manifest.json", {
    type: "application/json",
  });
  Object.defineProperty(chosen, "text", { value: () => Promise.resolve(text) });
  await user.upload(
    screen.getByLabelText(/Manifiesto de preservación/),
    chosen,
  );
  await user.upload(
    screen.getByLabelText(/Archivo a comprobar/),
    new File(["abc"], "archivo.txt"),
  );

  const compare = screen.getByRole("button", { name: "Comparar huellas" });
  await user.click(compare);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Inténtelo de nuevo",
  );
  expect(compare).toBeEnabled();
});
