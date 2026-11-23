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
const MESSAGES = "/api/v1/client-portal/messages";
const RUTA = "/portal";

const BASE_VIEW = {
  organization_name: "Restrepo Abogados",
  client_name: "María Pérez",
  expires_at: "2026-12-24T15:00:00Z",
  updates: [],
  messages: [],
  documents: [],
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

  it("lista los documentos y ofrece descargarlos con un envío del formulario", async () => {
    serve({
      [VIEW]: () =>
        jsonResponse({
          ...BASE_VIEW,
          notice_accepted: true,
          case_title: "Caso de María",
          case_status: "open",
          documents: [
            {
              id: "019e0000-0000-7000-8000-000000000009",
              filename: "resumen.pdf",
              size_bytes: 2048,
              created_at: "2026-11-24T15:00:00Z",
            },
          ],
        }),
    });
    const { container } = await renderRoute(`${RUTA}#t=${TOKEN}`);

    expect(
      await screen.findByRole("list", { name: "Documentos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("resumen.pdf")).toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Descargar resumen.pdf",
    });
    const form = button.closest("form")!;
    expect(form).toHaveAttribute(
      "action",
      "/api/v1/client-portal/documents/download",
    );
    expect(form).toHaveAttribute("method", "post");
    expect((form.elements.namedItem("token") as HTMLInputElement).value).toBe(
      TOKEN,
    );
    expect(
      (form.elements.namedItem("document_id") as HTMLInputElement).value,
    ).toBe("019e0000-0000-7000-8000-000000000009");
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("el cliente le escribe al despacho y ve su mensaje", async () => {
    let sent = false;
    serve({
      [VIEW]: () =>
        jsonResponse({
          ...BASE_VIEW,
          notice_accepted: true,
          case_title: "Caso de María",
          case_status: "open",
          messages: sent
            ? [
                {
                  id: "019e0000-0000-7000-8000-000000000002",
                  body: "¿Cómo va mi caso?",
                  created_at: "2026-11-24T16:00:00Z",
                },
              ]
            : [],
        }),
      [MESSAGES]: () => {
        sent = true;
        return jsonResponse(
          {
            id: "019e0000-0000-7000-8000-000000000002",
            body: "¿Cómo va mi caso?",
            created_at: "2026-11-24T16:00:00Z",
          },
          201,
        );
      },
    });
    const user = userEvent.setup();
    await renderRoute(`${RUTA}#t=${TOKEN}`);

    expect(
      await screen.findByRole("button", { name: "Enviar mensaje" }),
    ).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "Su mensaje" }),
      "¿Cómo va mi caso?",
    );
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    expect(
      await screen.findByRole("list", { name: "Sus mensajes" }),
    ).toBeInTheDocument();
    expect(await requests(MESSAGES)[0]!.json()).toEqual({
      token: TOKEN,
      body: "¿Cómo va mi caso?",
    });
    expect(screen.getByRole("textbox", { name: "Su mensaje" })).toHaveValue("");
  });

  it("en un caso archivado no ofrece escribir", async () => {
    serve({
      [VIEW]: () =>
        jsonResponse({
          ...BASE_VIEW,
          notice_accepted: true,
          case_title: "Caso de María",
          case_status: "closed",
        }),
    });
    await renderRoute(`${RUTA}#t=${TOKEN}`);

    expect(
      await screen.findByText(/ya no recibe mensajes/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enviar mensaje" }),
    ).not.toBeInTheDocument();
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
    expect(screen.getByText(/Caso archivado en/)).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
