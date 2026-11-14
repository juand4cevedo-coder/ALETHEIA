import { screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("no consulta facturación ni auditoría sin el cargo de plataforma", async () => {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    if (new URL(request.url).pathname === "/api/v1/me")
      return jsonResponse({
        id: "01890a5d-ac96-774b-bcce-b302099a8057",
        full_name: "Ana Restrepo",
        email: "ana@example.com",
        email_verified: true,
        platform_admin: false,
        permissions: [],
        organization: null,
        legal: {
          accepted_version: LEGAL_VERSION,
          current_version: LEGAL_VERSION,
          acceptance_required: false,
        },
      });
    throw new Error(`Ruta inesperada: ${request.method} ${request.url}`);
  });
  await renderRoute("/app/plataforma/facturacion");
  expect(
    await screen.findByText("Esta cuenta no administra la plataforma."),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
