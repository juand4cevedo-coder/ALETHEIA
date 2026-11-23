import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import type { CaseDetail } from "../../api/generated";
import { createQueryClient } from "../../api/queryClient.ts";
import { jsonResponse } from "../../test/render.tsx";
import { DeleteCaseDialog } from "./DeleteCaseDialog.tsx";

const fetchMock = vi.fn<typeof fetch>();
const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8070";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function detail(changes: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: CASE_ID,
    title: "Caso de María",
    status: "closed",
    legal_hold: false,
    retention_until: "2020-01-01T00:00:00Z",
    ...changes,
  } as CaseDetail;
}

function renderDialog(value: CaseDetail) {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <MemoryRouter initialEntries={["/caso"]}>
        <Routes>
          <Route path="/caso" element={<DeleteCaseDialog detail={value} />} />
          <Route path="/app/casos" element={<p>Lista de casos</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("exige escribir el título exacto antes de dejar eliminar", async () => {
  const user = userEvent.setup();
  renderDialog(detail());

  await user.click(
    screen.getByRole("button", { name: "Eliminar definitivamente" }),
  );
  const confirm = screen.getByRole("button", { name: "Eliminar para siempre" });
  expect(confirm).toBeDisabled();

  await user.type(screen.getByRole("textbox"), "caso de maría");
  expect(confirm).toBeDisabled();
  await user.clear(screen.getByRole("textbox"));
  await user.type(screen.getByRole("textbox"), "Caso de María");
  expect(confirm).toBeEnabled();
});

it("envía la confirmación y vuelve a la lista de casos", async () => {
  fetchMock.mockImplementation(async () =>
    jsonResponse({ detail: "Eliminación en curso." }, 202),
  );
  const user = userEvent.setup();
  renderDialog(detail());

  await user.click(
    screen.getByRole("button", { name: "Eliminar definitivamente" }),
  );
  await user.type(screen.getByRole("textbox"), "Caso de María");
  await user.click(
    screen.getByRole("button", { name: "Eliminar para siempre" }),
  );

  expect(await screen.findByText("Lista de casos")).toBeInTheDocument();
  const request = fetchMock.mock.calls[0]![0] as Request;
  expect(new URL(request.url).pathname).toBe(
    `/api/v1/cases/${CASE_ID}/deletion`,
  );
  expect(await request.json()).toEqual({ confirmation: "Caso de María" });
});

it("muestra el motivo del servidor si no se puede eliminar", async () => {
  fetchMock.mockImplementation(async () =>
    jsonResponse(
      {
        type: "about:blank",
        status: 409,
        detail: "El plazo de conservación del caso termina el 1 de enero.",
      },
      409,
    ),
  );
  const user = userEvent.setup();
  renderDialog(detail());

  await user.click(
    screen.getByRole("button", { name: "Eliminar definitivamente" }),
  );
  await user.type(screen.getByRole("textbox"), "Caso de María");
  await user.click(
    screen.getByRole("button", { name: "Eliminar para siempre" }),
  );

  expect(
    await screen.findByText(/plazo de conservación del caso termina/),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByText("Lista de casos")).not.toBeInTheDocument(),
  );
});

it("con bloqueo jurídico o plazo pendiente no deja eliminar y dice por qué", () => {
  const { unmount } = renderDialog(detail({ legal_hold: true }));
  expect(
    screen.getByRole("button", { name: "Eliminar definitivamente" }),
  ).toBeDisabled();
  expect(screen.getByText(/bloqueo jurídico vigente/)).toBeInTheDocument();
  unmount();

  renderDialog(detail({ retention_until: "2999-01-01T00:00:00Z" }));
  expect(
    screen.getByRole("button", { name: "Eliminar definitivamente" }),
  ).toBeDisabled();
  expect(screen.getByText(/Podrá eliminarse desde el/)).toBeInTheDocument();
});
