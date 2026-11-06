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
      return signedIn ? jsonResponse(ME) : problem(401);
    }
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
  it("tiene etiquetas visibles, autocompletado correcto y no tiene errores graves de accesibilidad", async () => {
    serve();
    const { container } = await renderRoute("/ingresar");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Qué bueno verle de nuevo",
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
      screen.getByRole("link", { name: "Crear cuenta gratis" }),
    ).toHaveAttribute("href", "/registro");
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
      await screen.findByRole("heading", { level: 1, name: "Ana Restrepo" }),
    ).toBeInTheDocument();
    const [request] = loginRequests();
    expect(request!.method).toBe("POST");
    expect(request!.headers.get(SAME_ORIGIN_HEADER)).toBe("1");
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
        "El correo o la contraseña no coinciden. Revise los datos.",
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

  it("si ya hay sesión, lleva directo al espacio de trabajo", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(ME));
    const { router } = await renderRoute("/ingresar");

    await waitFor(() => expect(router.state.location.pathname).toBe("/app"));
  });
});
