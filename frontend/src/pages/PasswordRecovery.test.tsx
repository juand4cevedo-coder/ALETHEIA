import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();
const NUEVA = "una frase nueva bastante larga";

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Ana Restrepo",
  email: "ana@example.com",
  email_verified: true,
  organization: {
    id: "01890a5d-ac96-774b-bcce-b302099a8058",
    name: "Restrepo Abogados",
    role: "owner",
  },
  legal: {
    accepted_version: LEGAL_VERSION,
    current_version: LEGAL_VERSION,
    acceptance_required: false,
  },
};

function problem(status: number, detail?: string): Response {
  return jsonResponse({ type: "about:blank", status, detail }, status);
}

function requests(path: string): Request[] {
  return fetchMock.mock.calls
    .map(([input]) => input as Request)
    .filter((request) => new URL(request.url).pathname === path);
}

/** Responde cada ruta con lo indicado; el perfil responde 401 si no se dice otra cosa. */
function serve(routes: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    const route = routes[path];
    if (route) return route();
    if (path === "/api/v1/me" || path === "/api/v1/auth/refresh") {
      return problem(401);
    }
    throw new Error(`Ruta inesperada: ${path}`);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as unknown as MediaQueryList),
  );
});

describe("Pedir el enlace (HU-010, API-011)", () => {
  it("se llega desde ingresar", async () => {
    serve({});
    const user = userEvent.setup();
    const { router } = await renderRoute("/ingresar");

    await user.click(
      await screen.findByRole("link", { name: "¿Olvidó su contraseña?" }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/recuperar"),
    );
  });

  it("envía el correo limpio y avisa sin decir si la cuenta existe", async () => {
    serve({
      "/api/v1/auth/password/forgot": () => jsonResponse({ detail: "ok" }, 202),
    });
    const user = userEvent.setup();
    const { container } = await renderRoute("/recuperar");
    expect(await seriousAxeViolations(container)).toEqual([]);

    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "  ana@example.com ",
    );
    await user.click(
      screen.getByRole("button", { name: "Enviarme el enlace" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Revise su correo" }),
    ).toHaveFocus();
    const [request] = requests("/api/v1/auth/password/forgot");
    expect(await request!.json()).toEqual({ email: "ana@example.com" });
    expect(
      screen.getByText(
        "Si el correo está registrado, recibirá un enlace para crear una contraseña nueva.",
      ),
    ).toBeInTheDocument();
  });

  it("valida el correo antes de enviar", async () => {
    serve({});
    const user = userEvent.setup();
    await renderRoute("/recuperar");

    await user.type(await screen.findByLabelText("Correo electrónico"), "ana");
    await user.click(
      screen.getByRole("button", { name: "Enviarme el enlace" }),
    );

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(requests("/api/v1/auth/password/forgot")).toHaveLength(0);
  });

  it("con demasiadas solicitudes pide esperar", async () => {
    serve({ "/api/v1/auth/password/forgot": () => problem(429) });
    const user = userEvent.setup();
    await renderRoute("/recuperar");

    await user.type(
      await screen.findByLabelText("Correo electrónico"),
      "ana@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Enviarme el enlace" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Espere 15 minutos",
    );
  });
});

describe("Elegir la contraseña nueva (HU-010, API-012)", () => {
  it("toma el token del fragmento, lo borra de la dirección y guarda la contraseña", async () => {
    serve({
      "/api/v1/auth/password/reset": () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    const { router, container } = await renderRoute(
      "/restablecer-contrasena#t=token-del-correo",
    );

    await waitFor(() => expect(router.state.location.hash).toBe(""));
    await user.type(await screen.findByLabelText("Contraseña nueva"), NUEVA);
    await user.click(
      screen.getByRole("button", { name: "Guardar la contraseña" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Su contraseña cambió" }),
    ).toHaveFocus();
    const [request] = requests("/api/v1/auth/password/reset");
    expect(await request!.json()).toEqual({
      token: "token-del-correo",
      password: NUEVA,
    });
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("una contraseña corta no se envía", async () => {
    serve({});
    const user = userEvent.setup();
    await renderRoute("/restablecer-contrasena#t=token");

    await user.type(await screen.findByLabelText("Contraseña nueva"), "corta");
    await user.click(
      screen.getByRole("button", { name: "Guardar la contraseña" }),
    );

    expect(
      screen.getByText("La contraseña debe tener al menos 12 caracteres."),
    ).toBeInTheDocument();
    expect(requests("/api/v1/auth/password/reset")).toHaveLength(0);
  });

  it("un enlace que ya no sirve lleva a pedir otro", async () => {
    serve({ "/api/v1/auth/password/reset": () => problem(400) });
    const user = userEvent.setup();
    await renderRoute("/restablecer-contrasena#t=usado");

    await user.type(await screen.findByLabelText("Contraseña nueva"), NUEVA);
    await user.click(
      screen.getByRole("button", { name: "Guardar la contraseña" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Este enlace ya no sirve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Pedir un enlace nuevo" }),
    ).toHaveAttribute("href", "/recuperar");
  });

  it("sin token muestra de una vez que el enlace no sirve", async () => {
    serve({});
    await renderRoute("/restablecer-contrasena");

    expect(
      await screen.findByRole("heading", { name: "Este enlace ya no sirve" }),
    ).toBeInTheDocument();
  });
});

describe("Cambiar la contraseña con sesión (HU-010, API-013)", () => {
  function serveSession(change: () => Response) {
    serve({
      "/api/v1/me": () => jsonResponse(ME),
      "/api/v1/me/password": change,
    });
  }

  async function fill(
    user: ReturnType<typeof userEvent.setup>,
    current: string,
    next: string,
  ) {
    await user.type(await screen.findByLabelText("Contraseña actual"), current);
    await user.type(screen.getByLabelText("Contraseña nueva"), next);
    await user.click(
      screen.getByRole("button", { name: "Cambiar la contraseña" }),
    );
  }

  it("se llega desde el menú de la cuenta y confirma el cambio", async () => {
    serveSession(() => new Response(null, { status: 204 }));
    const user = userEvent.setup();
    const { router, container } = await renderRoute("/app");

    await user.click(
      await screen.findByRole("button", { name: /Opciones de la cuenta/ }),
    );
    await user.click(
      screen.getByRole("link", { name: /Perfil, contraseña y sesiones/ }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/app/cuenta"),
    );
    await fill(user, "la contraseña de antes", NUEVA);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Su contraseña cambió",
    );
    const [request] = requests("/api/v1/me/password");
    expect(request!.method).toBe("PUT");
    expect(await request!.json()).toEqual({
      current_password: "la contraseña de antes",
      new_password: NUEVA,
    });
    expect(screen.getByLabelText("Contraseña actual")).toHaveValue("");
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("si la actual no coincide, la pide de nuevo", async () => {
    serveSession(() =>
      problem(
        400,
        "La contraseña actual no coincide. Revísela e inténtelo de nuevo.",
      ),
    );
    const user = userEvent.setup();
    await renderRoute("/app/cuenta");

    await fill(user, "equivocada", NUEVA);

    const actual = await screen.findByLabelText("Contraseña actual");
    await waitFor(() => expect(actual).toHaveFocus());
    expect(actual).toHaveAttribute("aria-invalid", "true");
    expect(actual).toHaveValue("");
  });

  it("no envía una contraseña nueva igual a la actual", async () => {
    serveSession(() => new Response(null, { status: 204 }));
    const user = userEvent.setup();
    await renderRoute("/app/cuenta");

    await fill(user, NUEVA, NUEVA);

    expect(
      screen.getByText("La contraseña nueva debe ser distinta de la actual."),
    ).toBeInTheDocument();
    expect(requests("/api/v1/me/password")).toHaveLength(0);
  });
});
