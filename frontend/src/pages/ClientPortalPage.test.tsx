import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();
const TOKEN = "un-token-de-prueba";
const VIEW = "/api/v1/client-portal/view";
const ACCEPT = "/api/v1/client-portal/accept-notice";
const RENEW = "/api/v1/client-portal/renew";
const RUTA = "/portal";

const BASE_VIEW = {
  organization_name: "Restrepo Abogados",
  client_name: "María Pérez",
  expires_at: "2026-12-24T15:00:00Z",
  updates: [],
};

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

describe("Portal del cliente (ADR-054)", () => {
  it("sin enlace dice que ya no sirve y no consulta nada", async () => {
    serve({});
    await renderRoute(RUTA);

    expect(
      await screen.findByRole("heading", { name: "Este enlace ya no sirve" }),
    ).toBeInTheDocument();
    expect(requests(VIEW)).toHaveLength(0);
  });

  it("un enlace vencido o reemplazado dice que ya no sirve", async () => {
    serve({
      [VIEW]: () => jsonResponse({ type: "about:blank", status: 404 }, 404),
    });
    await renderRoute(`${RUTA}#t=${TOKEN}`);

    expect(
      await screen.findByRole("heading", { name: "Este enlace ya no sirve" }),
    ).toBeInTheDocument();
  });

  it("con un enlace vencido deja pedir uno nuevo y responde lo mismo", async () => {
    serve({
      [VIEW]: () => jsonResponse({ type: "about:blank", status: 404 }, 404),
      [RENEW]: () =>
        jsonResponse({ detail: "Si el acceso sigue vigente..." }, 202),
    });
    const user = userEvent.setup();
    await renderRoute(`${RUTA}#t=${TOKEN}`);

    await user.click(
      await screen.findByRole("button", { name: "Pedir un enlace nuevo" }),
    );

    expect(
      await screen.findByText(/enviamos un enlace nuevo al correo/),
    ).toBeInTheDocument();
    expect(await requests(RENEW)[0]!.json()).toEqual({ token: TOKEN });
    expect(
      screen.queryByRole("button", { name: "Pedir un enlace nuevo" }),
    ).not.toBeInTheDocument();
  });

  it("pide aceptar el aviso de datos antes de mostrar el caso", async () => {
    let accepted = false;
    serve({
      [VIEW]: () =>
        jsonResponse(
          accepted
            ? {
                ...BASE_VIEW,
                notice_accepted: true,
                case_title: "Caso de María",
                case_status: "open",
                updates: [
                  {
                    id: "019e0000-0000-7000-8000-000000000001",
                    author_name: "Ana Restrepo",
                    body: "Se radicó la demanda.",
                    created_at: "2026-11-24T15:00:00Z",
                  },
                ],
              }
            : {
                ...BASE_VIEW,
                notice_accepted: false,
                case_title: null,
                case_status: null,
              },
        ),
      [ACCEPT]: () => {
        accepted = true;
        return new Response(null, { status: 204 });
      },
    });
    const user = userEvent.setup();
    const { container } = await renderRoute(`${RUTA}#t=${TOKEN}`);

    expect(
      await screen.findByRole("heading", { name: "Hola, María Pérez" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/corresponsables/)).toBeInTheDocument();
    expect(screen.queryByText("Caso de María")).not.toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);

    await user.click(
      screen.getByRole("button", { name: "Entiendo y quiero entrar" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Caso de María" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Se radicó la demanda.")).toBeInTheDocument();
    expect(await requests(ACCEPT)[0]!.json()).toEqual({ token: TOKEN });
    expect(await requests(VIEW)[0]!.json()).toEqual({ token: TOKEN });
  });

  it("sin avisos publicados lo dice con claridad", async () => {
    serve({
      [VIEW]: () =>
        jsonResponse({
          ...BASE_VIEW,
          notice_accepted: true,
          case_title: "Caso de María",
          case_status: "closed",
        }),
    });
    const { container } = await renderRoute(`${RUTA}#t=${TOKEN}`);

    expect(
      await screen.findByText(/todavía no le ha publicado avisos/),
    ).toBeInTheDocument();
    expect(screen.getByText(/archivado/)).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
