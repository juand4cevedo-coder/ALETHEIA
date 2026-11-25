import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

const ORGANIZATION_ID = "01890a5d-ac96-774b-bcce-b302099a8058";

function me(role: "owner" | "admin" | "lawyer" | "assistant") {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Ana Restrepo",
    email: "ana@example.com",
    email_verified: true,
    organization: {
      id: ORGANIZATION_ID,
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

type Handler = (request: Request) => Response | Promise<Response>;

function serve(
  role: "owner" | "admin" | "lawyer" | "assistant",
  routes: Record<string, Handler> = {},
) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    const key = `${request.method} ${path}`;
    if (routes[key]) return routes[key](request);
    if (path === "/api/v1/me") return jsonResponse(me(role));
    throw new Error(`Ruta inesperada: ${key}`);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Menú del espacio de trabajo", () => {
  it("la propietaria ve Organización y llega a la sección", async () => {
    serve("owner");
    const user = userEvent.setup();
    const { router } = await renderRoute("/app");

    const nav = await screen.findByRole("navigation", {
      name: "Espacio de trabajo",
    });
    await user.click(within(nav).getByRole("link", { name: "Organización" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/app/organizacion"),
    );
    await screen.findByRole("heading", { level: 1, name: "Organización" });
  });

  it.each(["admin", "lawyer", "assistant"] as const)(
    "un %s no ve Organización en el menú",
    async (role) => {
      serve(role);
      await renderRoute("/app");

      const nav = await screen.findByRole("navigation", {
        name: "Espacio de trabajo",
      });
      expect(
        within(nav).queryByRole("link", { name: "Organización" }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("Nombre del despacho (API-022)", () => {
  it("muestra el nombre vigente y lo guarda al cambiarlo", async () => {
    let received: unknown;
    serve("owner", {
      "PATCH /api/v1/organization": async (request) => {
        received = await request.json();
        return jsonResponse({
          id: ORGANIZATION_ID,
          name: "Restrepo y Asociados",
          created_at: "2026-01-01T00:00:00Z",
        });
      },
    });
    const user = userEvent.setup();
    await renderRoute("/app/organizacion");

    const field = await screen.findByLabelText("Nombre");
    expect(field).toHaveValue("Restrepo Abogados");

    await user.clear(field);
    await user.type(field, "Restrepo y Asociados");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await screen.findByText("Guardamos el nombre de su despacho.");
    expect(received).toEqual({ name: "Restrepo y Asociados" });
  });

  it("el botón de guardar queda inactivo sin cambios", async () => {
    serve("owner");
    await renderRoute("/app/organizacion");

    await screen.findByLabelText("Nombre");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("muestra el error si el servidor rechaza el nombre", async () => {
    serve("owner", {
      "PATCH /api/v1/organization": async () =>
        jsonResponse(
          { type: "about:blank", status: 422, detail: "Nombre inválido." },
          422,
        ),
    });
    const user = userEvent.setup();
    await renderRoute("/app/organizacion");

    const field = await screen.findByLabelText("Nombre");
    await user.clear(field);
    await user.type(field, "Otro nombre");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await screen.findByText("Nombre inválido.");
  });

  it.each(["admin", "lawyer", "assistant"] as const)(
    "un %s que entra directo a la ruta vuelve a Inicio",
    async (role) => {
      serve(role);
      const { router } = await renderRoute("/app/organizacion");

      await waitFor(() => expect(router.state.location.pathname).toBe("/app"));
    },
  );
});

describe("Políticas del despacho", () => {
  const POLICIES = {
    default_retention_years: 10,
    session_days: 14,
    require_two_factor: false,
  };

  it("la propietaria cambia la sesión y el segundo factor; la conservación no se muestra", async () => {
    let sent: unknown;
    serve("owner", {
      "GET /api/v1/organization/policies": () => jsonResponse(POLICIES),
      "PUT /api/v1/organization/policies": async (request) => {
        sent = await request.json();
        return jsonResponse(sent);
      },
    });
    const user = userEvent.setup();
    await renderRoute("/app/organizacion");

    await screen.findByLabelText("Duración de la sesión");
    expect(screen.queryByText(/años desde el cierre/)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Conservación de los casos archivados"),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Duración de la sesión"),
      "7",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Exigir la verificación en dos pasos a todo el equipo",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar políticas" }));

    expect(
      await screen.findByText("Guardamos las políticas."),
    ).toBeInTheDocument();
    expect(sent).toEqual({
      session_days: 7,
      require_two_factor: true,
    });
  });

  it("si el servidor la rechaza, muestra el motivo y deja la casilla como estaba", async () => {
    serve("owner", {
      "GET /api/v1/organization/policies": () => jsonResponse(POLICIES),
      "PUT /api/v1/organization/policies": () =>
        jsonResponse(
          {
            type: "about:blank",
            title: "Conflicto",
            status: 409,
            detail:
              "Para exigirlo al equipo, primero active su propia verificación en dos pasos en Mi cuenta.",
          },
          409,
        ),
    });
    const user = userEvent.setup();
    await renderRoute("/app/organizacion");

    const box = await screen.findByRole("checkbox", {
      name: "Exigir la verificación en dos pasos a todo el equipo",
    });
    await user.click(box);
    await user.click(screen.getByRole("button", { name: "Guardar políticas" }));

    expect(
      await screen.findByText(/primero active su propia verificación/),
    ).toBeInTheDocument();
    expect(box).not.toBeChecked();
  });
});
