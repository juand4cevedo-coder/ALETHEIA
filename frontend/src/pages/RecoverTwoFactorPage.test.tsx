import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();
const TOKEN = "un-token-de-prueba";
const BASE = "/api/v1/auth/two-factor-recovery";
const RUTA = "/recuperar-segundo-factor";

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
});

describe("Recuperar el segundo factor (ADR-053)", () => {
  it("pide los pasos con el correo y responde lo mismo exista o no la cuenta", async () => {
    serve({
      [BASE]: () => jsonResponse({ detail: "Si la cuenta existe..." }, 202),
    });
    const user = userEvent.setup();
    const { container } = await renderRoute(RUTA);

    await user.type(
      await screen.findByLabelText("Correo electrónico"),
      "ana@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Enviarme los pasos" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Revise su correo" }),
    ).toBeInTheDocument();
    expect(await requests(BASE)[0]!.json()).toEqual({
      email: "ana@example.com",
    });
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("no envía un correo mal escrito", async () => {
    serve({});
    const user = userEvent.setup();
    await renderRoute(RUTA);

    await user.type(await screen.findByLabelText("Correo electrónico"), "ana");
    await user.click(
      screen.getByRole("button", { name: "Enviarme los pasos" }),
    );

    expect(
      await screen.findByText(
        "Escriba un correo válido, por ejemplo nombre@dominio.com.",
      ),
    ).toBeInTheDocument();
    expect(requests(BASE)).toHaveLength(0);
  });

  it("confirma con el enlace y la contraseña, quita el token de la dirección y muestra la fecha", async () => {
    serve({
      [`${BASE}/confirm`]: () =>
        jsonResponse({ available_at: "2026-11-25T20:30:00Z" }),
    });
    const user = userEvent.setup();
    const { router } = await renderRoute(`${RUTA}#t=${TOKEN}`);

    await user.type(
      await screen.findByLabelText("Contraseña"),
      "mi frase para ALETHEIA",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar y empezar la espera" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "La espera de seguridad empezó",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/25 de noviembre de 2026/)).toBeInTheDocument();
    expect(router.state.location.hash).toBe("");
    expect(await requests(`${BASE}/confirm`)[0]!.json()).toEqual({
      token: TOKEN,
      password: "mi frase para ALETHEIA",
    });
  });

  it("dice que la contraseña no coincide y deja volver a intentar", async () => {
    serve({ [`${BASE}/confirm`]: () => problem(401) });
    const user = userEvent.setup();
    await renderRoute(`${RUTA}#t=${TOKEN}`);

    await user.type(await screen.findByLabelText("Contraseña"), "otra frase");
    await user.click(
      screen.getByRole("button", { name: "Confirmar y empezar la espera" }),
    );

    expect(
      await screen.findByText(
        "La contraseña no coincide. Vuelva a escribirla.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toHaveFocus();
  });

  it("explica que un enlace vencido o usado ya no sirve y ofrece pedir otro", async () => {
    serve({ [`${BASE}/confirm`]: () => problem(400) });
    const user = userEvent.setup();
    await renderRoute(`${RUTA}#t=${TOKEN}`);

    await user.type(await screen.findByLabelText("Contraseña"), "mi frase");
    await user.click(
      screen.getByRole("button", { name: "Confirmar y empezar la espera" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Este enlace ya no sirve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Pedir la recuperación" }),
    ).toHaveAttribute("href", RUTA);
  });

  it("no cancela solo al abrir el enlace: espera a que se pulse el botón", async () => {
    serve({ [`${BASE}/cancel`]: () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    await renderRoute(`${RUTA}#c=${TOKEN}`);

    const button = await screen.findByRole("button", {
      name: "Cancelar la recuperación",
    });
    expect(requests(`${BASE}/cancel`)).toHaveLength(0);

    await user.click(button);

    expect(
      await screen.findByRole("heading", {
        name: "La recuperación se canceló",
      }),
    ).toBeInTheDocument();
    expect(await requests(`${BASE}/cancel`)[0]!.json()).toEqual({
      token: TOKEN,
    });
  });

  it("termina la recuperación con el correo y la contraseña", async () => {
    serve({ [`${BASE}/complete`]: () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    await renderRoute(RUTA);

    await user.click(
      await screen.findByRole("button", { name: "Terminar la recuperación" }),
    );
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@example.com",
    );
    await user.type(
      screen.getByLabelText("Contraseña"),
      "mi frase para ALETHEIA",
    );
    await user.click(
      screen.getByRole("button", { name: "Terminar la recuperación" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Su segundo factor se recuperó",
      }),
    ).toBeInTheDocument();
    expect(await requests(`${BASE}/complete`)[0]!.json()).toEqual({
      email: "ana@example.com",
      password: "mi frase para ALETHEIA",
    });
  });

  it("muestra cuándo termina la espera si todavía no pasó", async () => {
    serve({
      [`${BASE}/complete`]: () =>
        problem(
          409,
          "La espera de seguridad termina el 25 de noviembre de 2026 a las 3:30 p. m. (hora de Colombia).",
        ),
    });
    const user = userEvent.setup();
    await renderRoute(RUTA);

    await user.click(
      await screen.findByRole("button", { name: "Terminar la recuperación" }),
    );
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@example.com",
    );
    await user.type(screen.getByLabelText("Contraseña"), "mi frase");
    await user.click(
      screen.getByRole("button", { name: "Terminar la recuperación" }),
    );

    expect(
      await screen.findByText(
        /La espera de seguridad termina el 25 de noviembre/,
      ),
    ).toBeInTheDocument();
  });
});
