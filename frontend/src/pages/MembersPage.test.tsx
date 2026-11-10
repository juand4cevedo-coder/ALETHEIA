import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

const ORGANIZATION_ID = "01890a5d-ac96-774b-bcce-b302099a8058";

function me(role: "owner" | "admin" | "lawyer" | "assistant") {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Ana Restrepo",
    email: "ana@example.com",
    email_verified: true,
    organization: { id: ORGANIZATION_ID, name: "Restrepo Abogados", role },
    legal: {
      accepted_version: LEGAL_VERSION,
      current_version: LEGAL_VERSION,
      acceptance_required: false,
    },
  };
}

const MEMBERS = {
  items: [
    {
      user_id: "01890a5d-ac96-774b-bcce-b302099a8057",
      full_name: "Ana Restrepo",
      email: "ana@example.com",
      role: "owner",
      joined_at: "2026-11-01T15:00:00Z",
    },
    {
      user_id: "01890a5d-ac96-774b-bcce-b302099a8060",
      full_name: "Carlos Gómez",
      email: "carlos@example.com",
      role: "lawyer",
      joined_at: "2026-11-03T15:00:00Z",
    },
  ],
  next_cursor: null,
  seats: { used: 3, included: 8, extra_user_price_cop: null, full: false },
};

const PENDING = {
  id: "01890a5d-ac96-774b-bcce-b302099a8070",
  email: "laura@example.com",
  role: "assistant",
  invited_at: "2026-11-06T15:00:00Z",
  expires_at: "2026-11-09T15:00:00Z",
  expired: false,
};

function problem(status: number, detail?: string): Response {
  return jsonResponse({ type: "about:blank", status, detail }, status);
}

function requests(method: string, path: string): Request[] {
  return fetchMock.mock.calls
    .map(([input]) => input as Request)
    .filter(
      (request) =>
        request.method === method && new URL(request.url).pathname === path,
    );
}

type Handler = (request: Request) => Response | Promise<Response>;

/** Una API mínima: el perfil con el rol dado y las rutas que la prueba agrega. */
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
    if (key === "GET /api/v1/organization/members")
      return jsonResponse(MEMBERS);
    if (key === "GET /api/v1/organization/invitations") {
      return jsonResponse({ items: [PENDING], next_cursor: null });
    }
    throw new Error(`Ruta inesperada: ${key}`);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Menú del espacio de trabajo (CMP-UI-011)", () => {
  it("el propietario ve Miembros y llega a la sección", async () => {
    serve("owner");
    const user = userEvent.setup();
    const { router } = await renderRoute("/app");

    const nav = await screen.findByRole("navigation", {
      name: "Espacio de trabajo",
    });
    await user.click(within(nav).getByRole("link", { name: "Miembros" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/app/miembros"),
    );
    await screen.findByRole("heading", { level: 1, name: "Miembros" });
    expect(within(nav).getByRole("link", { name: "Miembros" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each(["lawyer", "assistant"] as const)(
    "un %s no ve Miembros en el menú",
    async (role) => {
      serve(role);
      await renderRoute("/app");

      const nav = await screen.findByRole("navigation", {
        name: "Espacio de trabajo",
      });
      expect(
        within(nav).queryByRole("link", { name: "Miembros" }),
      ).not.toBeInTheDocument();
      expect(
        within(nav).getByRole("link", { name: "Mi cuenta" }),
      ).toBeInTheDocument();
    },
  );
});

describe("Miembros e invitaciones (UI-021, HU-011)", () => {
  it("muestra las personas, las invitaciones pendientes y el cupo", async () => {
    serve("owner");
    const { container } = await renderRoute("/app/miembros");

    expect(await screen.findByText("Carlos Gómez")).toBeInTheDocument();
    expect(screen.getByText("laura@example.com")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByText(/de 8 usuarios en uso/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Revocar la invitación de laura@example.com",
      }),
    ).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("invita con el correo y el rol elegidos y confirma el envío", async () => {
    serve("admin", {
      "POST /api/v1/organization/invitations": () =>
        jsonResponse(
          { ...PENDING, email: "marta@example.com", role: "admin" },
          201,
        ),
    });
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(await screen.findByRole("button", { name: "Invitar" }));
    const dialog = screen.getByRole("dialog", {
      name: "Invitar a una persona",
    });
    await user.type(
      within(dialog).getByLabelText("Correo electrónico"),
      " marta@example.com ",
    );
    await user.selectOptions(within(dialog).getByLabelText("Rol"), "admin");
    expect(
      within(dialog).getByText(/Gestiona el equipo, ve todos los casos/),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Enviar invitación" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Enviamos la invitación a marta@example.com.",
    );
    const [request] = requests("POST", "/api/v1/organization/invitations");
    expect(await request!.json()).toEqual({
      email: "marta@example.com",
      role: "admin",
    });
  });

  it("valida el correo antes de enviar", async () => {
    serve("owner");
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(await screen.findByRole("button", { name: "Invitar" }));
    await user.type(screen.getByLabelText("Correo electrónico"), "marta");
    await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(requests("POST", "/api/v1/organization/invitations")).toHaveLength(
      0,
    );
  });

  it("si el correo ya es miembro, lo dice junto al campo", async () => {
    serve("owner", {
      "POST /api/v1/organization/invitations": () =>
        problem(409, "Esta persona ya es miembro de su organización."),
    });
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(await screen.findByRole("button", { name: "Invitar" }));
    const email = screen.getByLabelText("Correo electrónico");
    await user.type(email, "carlos@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

    expect(
      await screen.findByText("Esta persona ya es miembro de su organización."),
    ).toBeInTheDocument();
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAttribute("aria-invalid", "true");
  });

  it("con el plan lleno no ofrece invitar y explica cómo seguir", async () => {
    serve("owner", {
      "GET /api/v1/organization/members": () =>
        jsonResponse({
          ...MEMBERS,
          seats: {
            used: 2,
            included: 2,
            extra_user_price_cop: null,
            full: true,
          },
        }),
    });
    await renderRoute("/app/miembros");

    expect(
      await screen.findByText(/Su plan ya no tiene cupo/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "cambie de plan" }),
    ).toHaveAttribute("href", "/precios");
    expect(
      screen.queryByRole("button", { name: "Invitar" }),
    ).not.toBeInTheDocument();
  });

  it("revoca una invitación después de confirmarlo", async () => {
    let revoked = false;
    serve("owner", {
      [`DELETE /api/v1/organization/invitations/${PENDING.id}`]: () => {
        revoked = true;
        return new Response(null, { status: 204 });
      },
      "GET /api/v1/organization/invitations": () =>
        jsonResponse({ items: revoked ? [] : [PENDING], next_cursor: null }),
    });
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(
      await screen.findByRole("button", {
        name: "Revocar la invitación de laura@example.com",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "¿Revocar la invitación?",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Revocar" }));

    expect(
      await screen.findByText(/No hay invitaciones pendientes/),
    ).toBeInTheDocument();
    expect(revoked).toBe(true);
  });

  it("un abogado que abre la dirección ve que no tiene permiso", async () => {
    serve("lawyer");
    await renderRoute("/app/miembros");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tiene permiso para esta acción.",
    );
    expect(requests("GET", "/api/v1/organization/members")).toHaveLength(0);
  });
});

describe("Cambiar el rol y retirar (UI-021, HU-013)", () => {
  const CARLOS = MEMBERS.items[1]!;
  const CARLOS_PATH = `/api/v1/organization/members/${CARLOS.user_id}`;

  it("solo ofrece gestionar a quien se puede: no al propietario ni a uno mismo", async () => {
    serve("admin", {
      "GET /api/v1/organization/members": () =>
        jsonResponse({
          ...MEMBERS,
          items: [
            ...MEMBERS.items,
            {
              user_id: "01890a5d-ac96-774b-bcce-b302099a8099",
              full_name: "Ana Restrepo",
              email: "ana@example.com",
              role: "admin",
              joined_at: "2026-11-04T15:00:00Z",
            },
          ],
        }),
    });
    const { container } = await renderRoute("/app/miembros");

    await screen.findByText("Carlos Gómez");
    // Quien tiene la sesión (la primera Ana, propietaria) no se gestiona: quedan Carlos y la
    // otra Ana.
    expect(
      screen.getAllByRole("button", { name: /^Cambiar el rol de / }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Retirar a Ana Restrepo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cambiar el rol de Carlos Gómez" }),
    ).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("cambia el rol con lo que permite cada uno y refresca la lista", async () => {
    let role = "lawyer";
    serve("owner", {
      [`PATCH ${CARLOS_PATH}`]: async (request) => {
        role = ((await request.clone().json()) as { role: string }).role;
        return jsonResponse({ ...CARLOS, role });
      },
      "GET /api/v1/organization/members": () =>
        jsonResponse({
          ...MEMBERS,
          items: [MEMBERS.items[0], { ...CARLOS, role }],
        }),
    });
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(
      await screen.findByRole("button", {
        name: "Cambiar el rol de Carlos Gómez",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Cambiar el rol" });
    const select = within(dialog).getByLabelText("Rol");
    expect(select).toHaveValue("lawyer");
    await user.selectOptions(select, "assistant");
    expect(
      within(dialog).getByText(/Sube evidencias en los casos que le asignan/),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Guardar el rol" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Cambiar el rol" }),
      ).toBeNull(),
    );
    const people = screen.getByRole("region", { name: "Personas" });
    expect(await within(people).findByText("Asistente")).toBeInTheDocument();
    expect(within(people).queryByText("Abogado")).not.toBeInTheDocument();
    const [request] = requests("PATCH", CARLOS_PATH);
    expect(await request!.json()).toEqual({ role: "assistant" });
  });

  it("si no cambia el rol, cierra sin llamar a la API", async () => {
    serve("owner");
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(
      await screen.findByRole("button", {
        name: "Cambiar el rol de Carlos Gómez",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar el rol" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Cambiar el rol" }),
      ).toBeNull(),
    );
    expect(requests("PATCH", CARLOS_PATH)).toHaveLength(0);
  });

  it("muestra el texto de la API si el cambio se rechaza", async () => {
    serve("owner", {
      [`PATCH ${CARLOS_PATH}`]: () =>
        problem(403, "Nadie puede cambiar el rol del propietario."),
    });
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(
      await screen.findByRole("button", {
        name: "Cambiar el rol de Carlos Gómez",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Cambiar el rol" });
    await user.selectOptions(within(dialog).getByLabelText("Rol"), "admin");
    await user.click(
      within(dialog).getByRole("button", { name: "Guardar el rol" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Nadie puede cambiar el rol del propietario.",
    );
  });

  it("retira a una persona después de confirmarlo", async () => {
    let removed = false;
    serve("owner", {
      [`DELETE ${CARLOS_PATH}`]: () => {
        removed = true;
        return new Response(null, { status: 204 });
      },
      "GET /api/v1/organization/members": () =>
        jsonResponse({
          ...MEMBERS,
          items: removed ? [MEMBERS.items[0]] : MEMBERS.items,
        }),
    });
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(
      await screen.findByRole("button", { name: "Retirar a Carlos Gómez" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "¿Retirar a esta persona?",
    });
    expect(
      within(dialog).getByText(/se cerrarán sus sesiones/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Retirar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Carlos Gómez ya no pertenece a la organización",
    );
    await waitFor(() =>
      expect(screen.queryByText("carlos@example.com")).not.toBeInTheDocument(),
    );
    expect(removed).toBe(true);
  });

  it("cancelar el retiro no llama a la API", async () => {
    serve("owner");
    const user = userEvent.setup();
    await renderRoute("/app/miembros");

    await user.click(
      await screen.findByRole("button", { name: "Retirar a Carlos Gómez" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(requests("DELETE", CARLOS_PATH)).toHaveLength(0);
  });
});
