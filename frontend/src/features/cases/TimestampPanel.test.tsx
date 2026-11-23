import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient.ts";
import { jsonResponse } from "../../test/render.tsx";
import { TimestampPanel } from "./TimestampPanel.tsx";

const fetchMock = vi.fn<typeof fetch>();
const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8070";
const EVIDENCE_ID = "01890a5d-ac96-774b-bcce-b302099a8071";
const SHA = "a".repeat(64);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function renderPanel(
  props: Partial<ComponentProps<typeof TimestampPanel>> = {},
) {
  const onChanged = vi.fn();
  render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <TimestampPanel
        caseId={CASE_ID}
        evidenceId={EVIDENCE_ID}
        filename="informe.pdf"
        sha256={SHA}
        status="pending"
        time={null}
        authority={null}
        canRetry
        onChanged={onChanged}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onChanged };
}

it("explica que el sello está pendiente", () => {
  renderPanel();
  expect(screen.getByText("Sello pendiente")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Pedir el sello otra vez" }),
  ).not.toBeInTheDocument();
});

it("con el sello obtenido dice cuándo y quién lo firmó y ofrece descargarlo", () => {
  renderPanel({
    status: "stamped",
    time: "2026-11-21T17:30:00Z",
    authority: "DigiCert, Inc.",
  });

  expect(screen.getByText("Sello obtenido")).toBeInTheDocument();
  expect(screen.getByText(/por DigiCert, Inc\./)).toBeInTheDocument();
  const link = screen.getByRole("link", { name: "Descargar el sello (.tsr)" });
  expect(link).toHaveAttribute(
    "href",
    `/api/v1/cases/${CASE_ID}/evidences/${EVIDENCE_ID}/timestamp`,
  );
  expect(screen.getByText(/openssl ts -verify/)).toBeInTheDocument();
  expect(screen.getByText(SHA)).toBeInTheDocument();
});

it("un sello fallido se pide otra vez y avisa a la pantalla", async () => {
  fetchMock.mockImplementation(async () =>
    jsonResponse({ detail: "Pedimos el sello otra vez." }, 202),
  );
  const user = userEvent.setup();
  const { onChanged } = renderPanel({ status: "failed" });

  await user.click(
    screen.getByRole("button", { name: "Pedir el sello otra vez" }),
  );

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const request = fetchMock.mock.calls[0]![0] as Request;
  expect(request.method).toBe("POST");
  expect(new URL(request.url).pathname).toBe(
    `/api/v1/cases/${CASE_ID}/evidences/${EVIDENCE_ID}/timestamp/retry`,
  );
});

it("muestra el motivo si no se pudo pedir otra vez", async () => {
  fetchMock.mockImplementation(async () =>
    jsonResponse(
      {
        type: "about:blank",
        status: 409,
        detail: "Solo se puede pedir de nuevo un sello que falló.",
      },
      409,
    ),
  );
  const user = userEvent.setup();
  renderPanel({ status: "failed" });

  await user.click(
    screen.getByRole("button", { name: "Pedir el sello otra vez" }),
  );

  expect(
    await screen.findByText("Solo se puede pedir de nuevo un sello que falló."),
  ).toBeInTheDocument();
});
