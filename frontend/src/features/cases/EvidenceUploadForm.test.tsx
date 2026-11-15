import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient.ts";
import { jsonResponse } from "../../test/render.tsx";
import { EvidenceUploadForm } from "./EvidenceUploadForm.tsx";

const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8090";

afterEach(() => vi.unstubAllGlobals());

it("envía tipo, origen y archivo en el orden que exige la API", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    jsonResponse(
      {
        id: "01890a5d-ac96-774b-bcce-b302099a8091",
        sha256: "a".repeat(64),
        size_bytes: 4,
        tsa_status: "pending",
      },
      201,
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient({})}>
      <EvidenceUploadForm caseId={CASE_ID} />
    </QueryClientProvider>,
  );

  await user.type(screen.getByLabelText("Origen declarado"), "Cliente");
  await user.upload(
    screen.getByLabelText("Archivo"),
    new File(["dato"], "registro.txt", { type: "text/plain" }),
  );
  const fileInput = screen.getByLabelText("Archivo") as HTMLInputElement;
  expect(fileInput.files?.[0]?.size).toBe(4);
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Conservar evidencia" })
      .closest("form")!,
  );

  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe(`/api/v1/cases/${CASE_ID}/evidences`);
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({ "X-Aletheia-Request": "1" });
  if (!(init?.body instanceof FormData))
    throw new Error("Falta el formulario multipart");
  const fields = [...init.body.entries()];
  expect(fields.map(([name]) => name)).toEqual(["tipo", "origen", "archivo"]);
  expect(fields[0]?.[1]).toBe("document");
  expect(fields[1]?.[1]).toBe("Cliente");
  expect(fields[2]?.[1]).toBeInstanceOf(File);
  expect(
    await screen.findByText("Archivo conservado. La huella SHA-256 es:"),
  ).toBeVisible();
});
