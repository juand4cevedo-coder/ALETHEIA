import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Ana Restrepo",
  email: "ana@example.com",
  email_verified: false,
  organization: {
    id: "01890a5d-ac96-774b-bcce-b302099a8058",
    name: "Restrepo Abogados",
    role: "lawyer",
  },
  legal: {
    accepted_version: LEGAL_VERSION,
    current_version: LEGAL_VERSION,
    acceptance_required: false,
  },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Espacio de trabajo protegido (API-014)", () => {
  it("sin sesión lleva a ingresar y recuerda la pantalla pedida", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { type: "about:blank", title: "Unauthorized", status: 401 },
        401,
      ),
    );
    const { router } = await renderRoute("/app");

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/ingresar"),
    );
    expect(router.state.location.state).toEqual({ from: "/app" });
  });

  it("con sesión muestra a la persona, su organización, su rol y el estado del correo", async () => {
    fetchMock.mockResolvedValue(jsonResponse(ME));
    const { container } = await renderRoute("/app");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ana Restrepo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Restrepo Abogados · Abogado")).toBeInTheDocument();
    expect(screen.getByText("Sin verificar")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Verifique su correo" }),
    ).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("si el servidor falla, lo dice y deja reintentar", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ type: "about:blank", title: "Error", status: 503 }, 503),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...ME, email_verified: true }),
    );
    await renderRoute("/app");

    const reintentar = await screen.findByRole("button", {
      name: "Intentar de nuevo",
    });
    reintentar.click();

    expect(await screen.findByText("Verificado")).toBeInTheDocument();
  });
});

describe("Sesión del espacio de trabajo (HU-009)", () => {
  // Una API mínima: el perfil responde mientras la sesión esté viva y los cierres la terminan.
  function serve({ failSignOut = false } = {}) {
    let alive = true;
    fetchMock.mockImplementation(async (input) => {
      const path = new URL((input as Request).url).pathname;
      if (path === "/api/v1/me") {
        return alive
          ? jsonResponse(ME)
          : jsonResponse({ type: "about:blank", status: 401 }, 401);
      }
      if (path === "/api/v1/auth/refresh") {
        return jsonResponse({ type: "about:blank", status: 401 }, 401);
      }
      if (
        path === "/api/v1/auth/logout" ||
        path === "/api/v1/auth/logout-all"
      ) {
        if (failSignOut) {
          return jsonResponse({ type: "about:blank", status: 503 }, 503);
        }
        alive = false;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Ruta inesperada: ${path}`);
    });
  }

  function requests(path: string): Request[] {
    return fetchMock.mock.calls
      .map(([input]) => input as Request)
      .filter((request) => new URL(request.url).pathname === path);
  }

  async function openMenu(user: ReturnType<typeof userEvent.setup>) {
    const trigger = await screen.findByRole("button", {
      name: /Opciones de la cuenta/,
    });
    await user.click(trigger);
    return trigger;
  }

  it("el menú muestra la cuenta y se cierra con Escape devolviendo el foco", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = await renderRoute("/app");

    const trigger = await openMenu(user);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("ana@example.com", { selector: "p" }),
    ).toBeVisible();
    expect(await seriousAxeViolations(container)).toEqual([]);

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("cerrar la sesión llama a la API, olvida la cuenta y lo confirma al ingresar", async () => {
    serve();
    const user = userEvent.setup();
    const { router } = await renderRoute("/app");

    await openMenu(user);
    await user.click(screen.getByRole("button", { name: /^Cerrar sesión/ }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/ingresar"),
    );
    const [request] = requests("/api/v1/auth/logout");
    expect(request!.method).toBe("POST");
    expect(request!.headers.get("X-Aletheia-Request")).toBe("1");
    expect(
      await screen.findByText("Cerró la sesión en este dispositivo."),
    ).toBeInTheDocument();
  });

  it("cerrar todas las sesiones pide confirmación antes de llamar a la API", async () => {
    serve();
    const user = userEvent.setup();
    const { router } = await renderRoute("/app");

    await openMenu(user);
    await user.click(
      screen.getByRole("button", { name: /Cerrar todas las sesiones/ }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "¿Cerrar todas las sesiones?",
    });
    expect(dialog).toHaveAttribute("open");
    expect(requests("/api/v1/auth/logout-all")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Cerrar todas" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/ingresar"),
    );
    expect(requests("/api/v1/auth/logout-all")).toHaveLength(1);
    expect(
      await screen.findByText(
        "Cerró la sesión en todos sus dispositivos. Para seguir, ingrese de nuevo.",
      ),
    ).toBeInTheDocument();
  });

  it("cancelar la confirmación no cierra nada", async () => {
    serve();
    const user = userEvent.setup();
    const { router } = await renderRoute("/app");

    await openMenu(user);
    await user.click(
      screen.getByRole("button", { name: /Cerrar todas las sesiones/ }),
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(requests("/api/v1/auth/logout-all")).toHaveLength(0);
    expect(router.state.location.pathname).toBe("/app");
  });

  it("si el cierre falla, lo dice y la persona sigue en su espacio", async () => {
    serve({ failSignOut: true });
    const user = userEvent.setup();
    const { router } = await renderRoute("/app");

    await openMenu(user);
    await user.click(screen.getByRole("button", { name: /^Cerrar sesión/ }));

    expect(
      await screen.findByText(
        "No pudimos cerrar la sesión. Revise su conexión e inténtelo de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/app");
  });
});
