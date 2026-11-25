import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADER } from "../api/runtimeConfig.ts";
import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

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

function problem(status: number, extra: Record<string, unknown> = {}) {
  return jsonResponse(
    { type: "about:blank", title: "Error", status, ...extra },
    status,
  );
}

type Api = { login?: () => Response; me?: () => Response };

// Atiende cada ruta de la API como lo haría el servidor. Sin sesión, /me responde 401, y
// después de un ingreso correcto responde con el perfil.
function serve({
  login = () => new Response(null, { status: 204 }),
  me = () => jsonResponse(ME),
}: Api = {}) {
  let signedIn = false;
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/auth/login") {
      const response = login();
      signedIn = response.status === 204;
      return response;
    }
    if (path === "/api/v1/me") {
      return signedIn ? me() : problem(401);
    }
    if (path === "/api/v1/platform/users")
      return jsonResponse({ items: [], next_cursor: null });
    throw new Error(`Ruta inesperada: ${path}`);
  });
}

function loginRequests(): Request[] {
  return fetchMock.mock.calls
    .map(([input]) => input as Request)
    .filter((r) => new URL(r.url).pathname === "/api/v1/auth/login");
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  password = "una frase larga y fácil",
) {
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "  Ana@Example.com ",
  );
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Ingresar (HU-007, CP-007)", () => {
  it("habilita Google solo cuando el backend confirma la configuración", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const path = new URL(url, "http://localhost").pathname;
      if (path === "/api/v1/auth/google/status")
        return jsonResponse({ enabled: true });
      throw new Error(`Ruta inesperada: ${path}`);
    });

    await renderRoute("/ingresar");

    expect(
      await screen.findByRole("link", { name: "Continuar con Google" }),
    ).toHaveAttribute("href", "/api/v1/auth/google/login");
  });

  it("explica cuando la identidad de Google todavía no está vinculada", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ enabled: true }));

    await renderRoute("/ingresar?google=sin-vinculo");

    expect(
      await screen.findByText(/todavía no está vinculada/),
    ).toBeInTheDocument();
  });

  it("lleva a la cuenta administradora a la consola de plataforma", async () => {
    serve({
      me: () =>
        jsonResponse({ ...ME, organization: null, platform_admin: true }),
    });
    const user = userEvent.setup();
    const { router } = await renderRoute("/ingresar");
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/app/plataforma"),
    );
  });
  it("tiene etiquetas visibles, autocompletado correcto y no tiene errores graves de accesibilidad", async () => {
    serve();
    const { container } = await renderRoute("/ingresar");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ingrese a su cuenta",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(
      screen.getByRole("link", { name: "Crear una cuenta" }),
    ).toHaveAttribute("href", "/registro");
    expect(
      screen.getByRole("button", { name: "Continuar con Google" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Microsoft/i }),
    ).not.toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("valida antes de enviar y no llama a la API con datos incompletos", async () => {
    serve();
    const user = userEvent.setup();
    await renderRoute("/ingresar");

    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(screen.getByLabelText("Correo electrónico")).toHaveFocus();
    expect(screen.getByText(/Escriba un correo válido/)).toBeInTheDocument();
    expect(screen.getByText("Escriba su contraseña.")).toBeInTheDocument();
    expect(loginRequests()).toHaveLength(0);
  });

  it("envía el correo limpio con el encabezado propio y entra al espacio de trabajo", async () => {
    serve();
    const user = userEvent.setup();
    await renderRoute("/ingresar");

    await fillAndSubmit(user);

    expect(
      await screen.findByRole("heading", { level: 1, name: /, Ana$/ }),
    ).toBeInTheDocument();
    const [request] = loginRequests();
    expect(request!.method).toBe("POST");
    expect(request!.headers.get(SAME_ORIGIN_HEADER)).toBe("1");
    // Cada ingreso viaja con su verificación de persona.
    expect(request!.headers.get("X-Aletheia-Captcha")).toBe(
      "solucion-de-prueba",
    );
    expect(await request!.json()).toEqual({
      email: "Ana@Example.com",
      password: "una frase larga y fácil",
    });
  });

  it("vuelve a la pantalla de /app que la persona intentaba abrir", async () => {
    serve();
    const user = userEvent.setup();
    const { router } = await renderRoute({
      pathname: "/ingresar",
      state: { from: "/app" },
    });

    await fillAndSubmit(user);

    await waitFor(() => expect(router.state.location.pathname).toBe("/app"));
  });

  it("no acepta un destino fuera del espacio de trabajo", async () => {
    serve();
    const user = userEvent.setup();
    const { router } = await renderRoute({
      pathname: "/ingresar",
      state: { from: "//otro-sitio.example/app" },
    });

    await fillAndSubmit(user);

    await waitFor(() => expect(router.state.location.pathname).toBe("/app"));
  });

  it("muestra el mensaje genérico, conserva el correo y pide de nuevo la contraseña", async () => {
    serve({ login: () => problem(401) });
    const user = userEvent.setup();
    await renderRoute("/ingresar");

    await fillAndSubmit(user, "una clave equivocada");

    expect(
      await screen.findByText(
        "El correo o la contraseña no coinciden. Revise los datos o recupere su contraseña.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "Ana@Example.com",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(screen.getByLabelText("Contraseña")).toHaveFocus();
  });

  it("avisa que debe esperar cuando hay demasiados intentos", async () => {
    serve({ login: () => problem(429) });
    const user = userEvent.setup();
    await renderRoute("/ingresar");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hizo varios intentos seguidos. Espere 15 minutos e inténtelo de nuevo.",
    );
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("muestra el aviso de cuenta bloqueada que da la API", async () => {
    const detail =
      "Esta cuenta está bloqueada. Escríbanos a contacto@aletheia.sbs para revisar su caso.";
    serve({ login: () => problem(403, { detail }) });
    const user = userEvent.setup();
    await renderRoute("/ingresar");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
  });

  it("da el código de la solicitud cuando falla el servidor", async () => {
    serve({ login: () => problem(500, { request_id: "abc12345-0000" }) });
    const user = userEvent.setup();
    await renderRoute("/ingresar");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("abc12345-0000");
  });
});

describe("Acceso con una sesión abierta (Diseño UX/UI, 4.2)", () => {
  it("sin pista de sesión muestra el formulario y no consulta el perfil", async () => {
    fetchMock.mockImplementation(async () => problem(401));
    await renderRoute("/ingresar");

    expect(
      await screen.findByRole("heading", { name: "Ingrese a su cuenta" }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        (input as Request).url.endsWith("/api/v1/me"),
      ),
    ).toBe(false);
  });

  it("con una sesión válida lleva al espacio de trabajo", async () => {
    window.localStorage.setItem("aletheia:sesion", "1");
    fetchMock.mockImplementation(async (input) => {
      const path = new URL((input as Request).url).pathname;
      return path === "/api/v1/me" ? jsonResponse(ME) : problem(404);
    });
    const { router } = await renderRoute("/registro");

    await waitFor(() => expect(router.state.location.pathname).toBe("/app"));
  });

  it("con segundo factor pide el código y entra al espacio de trabajo al verificarlo", async () => {
    let verified = false;
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      const path = new URL(request.url).pathname;
      if (path === "/api/v1/auth/login") {
        return jsonResponse({ two_factor_required: true }, 202);
      }
      if (path === "/api/v1/auth/login/two-factor") {
        verified = true;
        return new Response(null, { status: 204 });
      }
      if (path === "/api/v1/me") {
        return verified ? jsonResponse(ME) : problem(401);
      }
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const user = userEvent.setup();
    await renderRoute("/ingresar");

    await fillAndSubmit(user);
    expect(
      await screen.findByRole("heading", {
        name: "Verificación en dos pasos",
      }),
    ).toBeInTheDocument();
    // La contraseña no se vuelve a pedir y la sesión todavía no existe.
    expect(screen.queryByLabelText("Contraseña")).toBeNull();
    expect(verified).toBe(false);
    // Quien perdió el teléfono y los códigos tiene a dónde ir.
    expect(
      screen.getByRole("link", { name: "No tengo mi teléfono ni mis códigos" }),
    ).toHaveAttribute("href", "/recuperar-segundo-factor");

    await user.type(screen.getByLabelText("Código"), "123 456");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /, Ana$/ }),
    ).toBeInTheDocument();
  });

  it("un código errado en el segundo paso muestra el aviso y deja reintentar", async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = new URL((input as Request).url).pathname;
      if (path === "/api/v1/auth/login") {
        return jsonResponse({ two_factor_required: true }, 202);
      }
      if (path === "/api/v1/auth/login/two-factor") return problem(401);
      if (path === "/api/v1/me") return problem(401);
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const user = userEvent.setup();
    await renderRoute("/ingresar");

    await fillAndSubmit(user);
    await user.type(await screen.findByLabelText("Código"), "000000");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    expect(
      await screen.findByText(/El código no es válido o el ingreso venció/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verificar" })).toBeEnabled();
  });

  it("si la sesión ya venció se queda en ingresar", async () => {
    window.localStorage.setItem("aletheia:sesion", "1");
    fetchMock.mockImplementation(async () => problem(401));
    const { router } = await renderRoute("/ingresar");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          (input as Request).url.endsWith("/api/v1/me"),
        ),
      ).toBe(true),
    );
    expect(router.state.location.pathname).toBe("/ingresar");
    expect(
      screen.getByRole("heading", { name: "Ingrese a su cuenta" }),
    ).toBeInTheDocument();
  });
});
