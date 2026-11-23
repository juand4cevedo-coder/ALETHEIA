import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("filtra por acción, persona y fechas desde el servidor y conserva la selección", async () => {
  const auditQueries: URLSearchParams[] = [];
  fetchMock.mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    if (url.pathname === "/api/v1/me") return jsonResponse(profile("owner"));
    if (url.pathname === "/api/v1/organization/members")
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
    if (url.pathname === "/api/v1/organization/audit") {
      auditQueries.push(new URLSearchParams(url.search));
      return jsonResponse({ items: [], next_cursor: null });
    }
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
  const user = userEvent.setup();
  const { router } = await renderRoute("/app/auditoria");
  await screen.findByText("No hay eventos en esta página.");

  await user.selectOptions(screen.getByLabelText("Acción"), "role_changed");
  await user.selectOptions(
    screen.getByLabelText("Persona"),
    "01890a5d-ac96-774b-bcce-b302099a8057",
  );
  await user.type(screen.getByLabelText("Desde"), "2026-11-01");
  await user.type(screen.getByLabelText("Hasta"), "2026-11-21");

  await waitFor(() => {
    const query = auditQueries.at(-1);
    expect(query?.get("action")).toBe("role_changed");
    expect(query?.get("actor")).toBe("01890a5d-ac96-774b-bcce-b302099a8057");
    expect(query?.get("created_from")).toBe("2026-11-01T05:00:00.000Z");
    expect(query?.get("created_to")).toBe("2026-11-22T05:00:00.000Z");
  });
  expect(router.state.location.search).toContain("accion=role_changed");
  expect(router.state.location.search).toContain("desde=2026-11-01");
  expect(
    screen.getByText("No encontramos eventos con estos filtros."),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  expect(router.state.location.search).toBe("");
});

function serveAudit(exportResponse: () => Response) {
  fetchMock.mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    if (path === "/api/v1/me") return jsonResponse(profile("owner"));
    if (path === "/api/v1/organization/members")
      return jsonResponse({
        items: [],
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
      return jsonResponse({ items: [], next_cursor: null });
    if (path === "/api/v1/organization/audit/export") return exportResponse();
    throw new Error(`Ruta inesperada: ${path}`);
  });
}

function csv(headers: Record<string, string> = {}) {
  return new Response("fecha_utc,accion", {
    status: 200,
    headers: {
      "content-type": "text/csv",
      "content-disposition":
        'attachment; filename="auditoria-aletheia-2026-11-22.csv"',
      "x-rows-truncated": "0",
      ...headers,
    },
  });
}

function stubDownload() {
  const create = vi.fn(() => "blob:auditoria");
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  return { create, click };
}

it("descarga la auditoría con los mismos filtros de la lista", async () => {
  serveAudit(() => csv());
  const { create, click } = stubDownload();
  const user = userEvent.setup();
  await renderRoute("/app/auditoria?accion=role_changed&desde=2026-11-01");

  await user.click(
    await screen.findByRole("button", { name: /Descargar CSV/ }),
  );
  await waitFor(() => expect(click).toHaveBeenCalled());
  expect(create).toHaveBeenCalled();

  const request = fetchMock.mock.calls
    .map(([input]) => new URL((input as Request).url))
    .find((url) => url.pathname.endsWith("/audit/export"))!;
  expect(request.searchParams.get("action")).toBe("role_changed");
  expect(request.searchParams.get("created_from")).toBe(
    "2026-11-01T05:00:00.000Z",
  );
  expect(screen.queryByText(/solo los 5000 eventos/)).toBeNull();
});

it("avisa cuando la descarga se recortó a los eventos más recientes", async () => {
  serveAudit(() => csv({ "x-rows-truncated": "1" }));
  stubDownload();
  const user = userEvent.setup();
  await renderRoute("/app/auditoria");

  await user.click(
    await screen.findByRole("button", { name: /Descargar CSV/ }),
  );
  expect(
    await screen.findByText(/solo los 5000 eventos más recientes/),
  ).toBeInTheDocument();
});

it("explica cuando no se pudo preparar la descarga", async () => {
  serveAudit(() => new Response("{}", { status: 500 }));
  stubDownload();
  const user = userEvent.setup();
  await renderRoute("/app/auditoria");

  await user.click(
    await screen.findByRole("button", { name: /Descargar CSV/ }),
  );
  expect(
    await screen.findByText(/No pudimos preparar la descarga/),
  ).toBeInTheDocument();
});
