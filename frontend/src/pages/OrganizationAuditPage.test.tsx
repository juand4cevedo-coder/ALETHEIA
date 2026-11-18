import { screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function profile(role: "owner" | "lawyer") {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Ana Restrepo",
    email: "ana@example.com",
    email_verified: true,
    platform_admin: false,
    permissions: [],
    organization: {
      id: "01890a5d-ac96-774b-bcce-b302099a8058",
      name: "Restrepo Abogados",
      role,
    },
    legal: {
      accepted_version: LEGAL_VERSION,
      current_version: LEGAL_VERSION,
      acceptance_required: false,
    },
  };
}

it("muestra eventos de seguridad al propietario sin contenido de casos", async () => {
  fetchMock.mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    if (path === "/api/v1/me") return jsonResponse(profile("owner"));
    if (path === "/api/v1/organization/members")
      return jsonResponse({
        items: [
          {
            user_id: "01890a5d-ac96-774b-bcce-b302099a8057",
            full_name: "Ana Restrepo",
            email: "ana@example.com",
            role: "owner",
            joined_at: "2026-01-01T00:00:00Z",
          },
        ],
        next_cursor: null,
        seats: {
          used: 1,
          included: 1,
          full: false,
          owner_exempt: true,
          extra_user_price_cop: null,
        },
      });
    if (path === "/api/v1/organization/audit")
      return jsonResponse({
        items: [
          {
            id: "01890a5d-ac96-774b-bcce-b302099a8060",
            action: "role_changed",
            actor_user_id: "01890a5d-ac96-774b-bcce-b302099a8057",
            target_id: "01890a5d-ac96-774b-bcce-b302099a8099",
            ip: "192.0.2.10",
            user_agent: "Navegador de prueba",
            created_at: "2026-11-16T12:00:00Z",
          },
        ],
        next_cursor: null,
      });
    throw new Error(`Ruta inesperada: ${path}`);
  });
  await renderRoute("/app/auditoria");
  expect(
    await screen.findByRole("rowheader", { name: "Rol cambiado" }),
  ).toBeInTheDocument();
  const table = screen.getByRole("table");
  expect(within(table).getByText("192.0.2.10")).toBeInTheDocument();
  // La persona resuelve a su nombre, no al identificador crudo.
  expect(within(table).getByText("Ana Restrepo")).toBeInTheDocument();
  // El objeto ya no es miembro: se avisa en vez de mostrar su id.
  expect(
    within(table).getByText("Persona que ya no está en el despacho"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("01890a5d-ac96-774b-bcce-b302099a8057"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/caso abierto/i)).not.toBeInTheDocument();
});

it("no consulta eventos cuando entra un abogado por la URL directa", async () => {
  fetchMock.mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    if (path === "/api/v1/me") return jsonResponse(profile("lawyer"));
    throw new Error(`Ruta inesperada: ${path}`);
  });
  await renderRoute("/app/auditoria");
  expect(
    await screen.findByText("Esta cuenta no administra el despacho."),
  ).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.some(
      ([input]) =>
        new URL((input as Request).url).pathname ===
        "/api/v1/organization/audit",
    ),
  ).toBe(false);
});
