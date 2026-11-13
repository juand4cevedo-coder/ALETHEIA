import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();
const TOKEN = "un-token-de-prueba";
const NUEVA = "mi frase nueva para ALETHEIA";

function preview(account: "new" | "existing" | "member_elsewhere") {
  return {
    organization_name: "Restrepo Abogados",
    inviter_name: "Ana Restrepo",
    email: "carlos@example.com",
    role: "lawyer",
    expires_at: "2026-11-10T15:00:00Z",
    account,
  };
}

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8060",
  full_name: "Carlos Gómez",
  email: "carlos@example.com",
  email_verified: true,
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

function problem(status: number, detail?: string): Response {
  return jsonResponse({ type: "about:blank", status, detail }, status);
}

function requests(path: string): Request[] {
  return fetchMock.mock.calls
    .map(([input]) => input as Request)
    .filter((request) => new URL(request.url).pathname === path);
}

function serve(routes: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    const route = routes[path];
    if (route) return route();
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

describe("Aceptar una invitación (UI-011, HU-012)", () => {
  it("toma el token del fragmento, lo borra y muestra la organización y el rol", async () => {
    serve({
      "/api/v1/invitations/preview": () => jsonResponse(preview("new")),
    });
    const { router, container } = await renderRoute(`/invitacion#t=${TOKEN}`);

    expect(
      await screen.findByRole("heading", { name: "Únase a Restrepo Abogados" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ana Restrepo le envió una invitación/),
    ).toHaveTextContent("Abogado");
    expect(router.state.location.hash).toBe("");
    const [request] = requests("/api/v1/invitations/preview");
    expect(await request!.json()).toEqual({ token: TOKEN });
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("crea la cuenta con nombre, contraseña y los textos aceptados, y entra", async () => {
    let accepted = false;
    serve({
      "/api/v1/invitations/preview": () => jsonResponse(preview("new")),
      "/api/v1/invitations/accept": () => {
        accepted = true;
        return jsonResponse(
          { organization_name: "Restrepo Abogados", role: "lawyer" },
          201,
        );
      },
      "/api/v1/me": () => (accepted ? jsonResponse(ME) : problem(401)),
    });
    const user = userEvent.setup();
    const { router } = await renderRoute(`/invitacion#t=${TOKEN}`);

    await user.type(
      await screen.findByLabelText("Nombre completo"),
      "  Carlos Gómez ",
    );
    await user.type(screen.getByLabelText("Contraseña nueva"), NUEVA);
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Crear mi cuenta y entrar" }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe("/app"));
    const [request] = requests("/api/v1/invitations/accept");
    expect(await request!.json()).toEqual({
      token: TOKEN,
      full_name: "Carlos Gómez",
      password: NUEVA,
      legal_version: LEGAL_VERSION,
      accepts_legal_terms: true,
    });
    expect(window.localStorage.getItem("aletheia:sesion")).toBe("1");
  });

  it("no envía sin aceptar los textos", async () => {
    serve({
      "/api/v1/invitations/preview": () => jsonResponse(preview("new")),
    });
    const user = userEvent.setup();
    await renderRoute(`/invitacion#t=${TOKEN}`);

    await user.type(
      await screen.findByLabelText("Nombre completo"),
      "Carlos Gómez",
    );
    await user.type(screen.getByLabelText("Contraseña nueva"), NUEVA);
    await user.click(
      screen.getByRole("button", { name: "Crear mi cuenta y entrar" }),
    );

    await waitFor(() => expect(screen.getByRole("checkbox")).toHaveFocus());
    expect(requests("/api/v1/invitations/accept")).toHaveLength(0);
  });

  it("con una cuenta existente pide solo la contraseña y muestra si no coincide", async () => {
    serve({
      "/api/v1/invitations/preview": () => jsonResponse(preview("existing")),
      "/api/v1/invitations/accept": () =>
        problem(
          401,
          "La contraseña no coincide con la de su cuenta. Revísela o recupérela.",
        ),
    });
    const user = userEvent.setup();
    await renderRoute(`/invitacion#t=${TOKEN}`);

    expect(
      await screen.findByText(/Ya tiene una cuenta con este correo/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
    const password = screen.getByLabelText("Contraseña");
    await user.type(password, "otra frase cualquiera");
    await user.click(
      screen.getByRole("button", { name: "Aceptar la invitación" }),
    );

    expect(
      await screen.findByText(/La contraseña no coincide con la de su cuenta/),
    ).toBeInTheDocument();
    await waitFor(() => expect(password).toHaveFocus());
    expect(password).toHaveValue("");
    const [request] = requests("/api/v1/invitations/accept");
    expect(await request!.json()).toEqual({
      token: TOKEN,
      password: "otra frase cualquiera",
    });
  });

  it("si el correo ya está en otra organización, lo explica sin formulario", async () => {
    serve({
      "/api/v1/invitations/preview": () =>
        jsonResponse(preview("member_elsewhere")),
    });
    await renderRoute(`/invitacion#t=${TOKEN}`);

    expect(
      await screen.findByRole("heading", {
        name: "Su correo ya está en otra organización",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("un enlace que ya no sirve lo dice y no muestra el formulario", async () => {
    serve({
      "/api/v1/invitations/preview": () =>
        problem(400, "Esta invitación ya no sirve."),
    });
    await renderRoute(`/invitacion#t=${TOKEN}`);

    expect(
      await screen.findByRole("heading", {
        name: "Esta invitación ya no sirve",
      }),
    ).toBeInTheDocument();
  });

  it("sin token no consulta la API", async () => {
    serve({});
    await renderRoute("/invitacion");

    expect(
      await screen.findByRole("heading", {
        name: "Esta invitación ya no sirve",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
