import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient.ts";
import { EvidenceUploadForm } from "./EvidenceUploadForm.tsx";

const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8090";

/** fetch no avisa del progreso de subida; por eso el formulario usa XMLHttpRequest
 * (sessionUpload en sessionFetch.ts). Esta implementación mínima deja que cada prueba decida
 * la respuesta a través de FakeXMLHttpRequest.handle. */
type FakeXhrHandler = (xhr: FakeXMLHttpRequest) => void;

class FakeXMLHttpRequest {
  static handle: FakeXhrHandler = () => {};
  static last: FakeXMLHttpRequest | null = null;

  method = "";
  url = "";
  status = 0;
  statusText = "";
  responseText = "";
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  requestHeaders: Record<string, string> = {};
  body: FormData | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  send(body: FormData) {
    this.body = body;
    FakeXMLHttpRequest.last = this;
    queueMicrotask(() => FakeXMLHttpRequest.handle(this));
  }
}

function progressEvent(loaded: number, total: number): ProgressEvent {
  return { lengthComputable: true, loaded, total } as ProgressEvent;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeXMLHttpRequest.handle = () => {};
  FakeXMLHttpRequest.last = null;
});

function renderForm() {
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
  return render(
    <QueryClientProvider client={createQueryClient({})}>
      <EvidenceUploadForm caseId={CASE_ID} />
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Origen declarado"), "Cliente");
  await user.upload(
    screen.getByLabelText("Archivo"),
    new File(["dato"], "registro.txt", { type: "text/plain" }),
  );
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Conservar evidencia" })
      .closest("form")!,
  );
}

it("envía tipo, origen y archivo en el orden que exige la API, y muestra el progreso de subida", async () => {
  FakeXMLHttpRequest.handle = (xhr) => {
    xhr.upload.onprogress?.(progressEvent(2, 4));
    xhr.status = 201;
    xhr.responseText = JSON.stringify({
      id: "01890a5d-ac96-774b-bcce-b302099a8091",
      sha256: "a".repeat(64),
      size_bytes: 4,
      tsa_status: "pending",
    });
    xhr.onload?.();
  };
  const user = userEvent.setup();
  renderForm();

  await fillAndSubmit(user);

  const fileInput = screen.getByLabelText("Archivo") as HTMLInputElement;
  expect(fileInput.files?.[0]?.size).toBe(4);

  expect(
    await screen.findByText("Archivo conservado. La huella SHA-256 es:"),
  ).toBeVisible();

  const sent = FakeXMLHttpRequest.last;
  if (!sent) throw new Error("No se envió la petición.");
  expect(new URL(sent.url).pathname).toBe(`/api/v1/cases/${CASE_ID}/evidences`);
  expect(sent.method).toBe("POST");
  expect(sent.requestHeaders).toEqual({ "X-Aletheia-Request": "1" });
  if (!(sent.body instanceof FormData))
    throw new Error("Falta el formulario multipart");
  const fields = [...sent.body.entries()];
  expect(fields.map(([name]) => name)).toEqual(["tipo", "origen", "archivo"]);
  expect(fields[0]?.[1]).toBe("document");
  expect(fields[1]?.[1]).toBe("Cliente");
  expect(fields[2]?.[1]).toBeInstanceOf(File);
});

it("un 413 explica que el archivo o el plan no tienen espacio", async () => {
  FakeXMLHttpRequest.handle = (xhr) => {
    xhr.status = 413;
    xhr.responseText = "";
    xhr.onload?.();
  };
  const user = userEvent.setup();
  renderForm();

  await fillAndSubmit(user);

  expect(
    await screen.findByText(
      "El archivo supera el límite de tamaño o el espacio disponible del plan.",
    ),
  ).toBeVisible();
});

it("ante una falla de red no inventa un resultado", async () => {
  FakeXMLHttpRequest.handle = (xhr) => {
    xhr.onerror?.();
  };
  const user = userEvent.setup();
  renderForm();

  await fillAndSubmit(user);

  expect(
    await screen.findByText(
      "Se interrumpió la carga. Compruebe su conexión e inténtelo de nuevo.",
    ),
  ).toBeVisible();
});

it("no deja enviar dos veces mientras la carga está en curso", async () => {
  const pending: { resolve: (() => void) | null } = { resolve: null };
  FakeXMLHttpRequest.handle = (xhr) => {
    pending.resolve = () => {
      xhr.status = 201;
      xhr.responseText = JSON.stringify({
        id: "01890a5d-ac96-774b-bcce-b302099a8091",
        sha256: "a".repeat(64),
        size_bytes: 4,
        tsa_status: "pending",
      });
      xhr.onload?.();
    };
  };
  const user = userEvent.setup();
  renderForm();

  await fillAndSubmit(user);

  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Conservando archivo" }),
    ).toBeDisabled(),
  );

  pending.resolve?.();
  await screen.findByText("Archivo conservado. La huella SHA-256 es:");
});
