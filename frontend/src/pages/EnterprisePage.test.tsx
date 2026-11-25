import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicPlan } from "../api/generated";
import { CATALOGO_PUBLICADO } from "../features/billing/published.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

// El catálogo de hoy, el mismo que viaja con el sitio.
const PLANS: PublicPlan[] = [...CATALOGO_PUBLICADO];

type Sent = { body: Record<string, unknown>; captcha: string | null };

function serve(
  answer: (sent: Sent) => Response = () =>
    jsonResponse(
      { filing_number: "PQR-2026-00042", detail: "Recibimos su solicitud." },
      201,
    ),
) {
  const sent: Sent[] = [];
  fetchMock.mockImplementation(async (input, init) => {
    const isRequest = typeof input !== "string";
    const url = isRequest ? (input as Request).url : String(input);
    const path = new URL(url, "http://localhost").pathname;
    const method = isRequest
      ? (input as Request).method
      : (init?.method ?? "GET");
    if (path === "/api/v1/plans") return jsonResponse(PLANS);
    if (path === "/api/v1/sales-inquiries" && method === "POST") {
      const request = input as Request;
      const entry = {
        body: (await request.json()) as Record<string, unknown>,
        captcha: request.headers.get("X-Aletheia-Captcha"),
      };
      sent.push(entry);
      return answer(entry);
    }
    throw new Error(`Ruta inesperada: ${method} ${path}`);
  });
  return sent;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre"), "Laura Restrepo");
  await user.type(
    screen.getByLabelText("Firma u oficina"),
    "Restrepo & Asociados",
  );
  await user.type(screen.getByLabelText("Correo"), "laura@restrepo.co");
  await user.type(screen.getByLabelText("Número aproximado de usuarios"), "40");
}

describe("Página para empresas (/empresa)", () => {
  it("cuenta el escenario del despacho con los roles, el portal y el precio del catálogo", async () => {
    serve();
    const { container } = await renderRoute("/empresa");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "ALETHEIA para despachos con varias personas",
      }),
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", {
      name: "Cuéntenos cómo trabaja su despacho",
    });
    expect(cta).toHaveAttribute("href", "#cotizar");
    for (const role of [
      "Responsable",
      "Administrador",
      "Abogado",
      "Asistente",
    ]) {
      expect(
        screen.getByRole("heading", { level: 3, name: role }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("heading", {
        name: "El cliente ve lo que usted le publica",
      }),
    ).toBeInTheDocument();

    // Las cinco personas del ejemplo caben más baratas en Profesional, con un adicional.
    const example = await screen.findByLabelText(
      "Un despacho de 5 personas en el plan Profesional",
    );
    expect(
      within(example).getByText("1 usuario adicional a $19.900"),
    ).toBeInTheDocument();
    expect(within(example).getByText("$79.800")).toBeInTheDocument();
    expect(
      screen.getByText(/Desde 9 personas conviene el plan Firma/),
    ).toBeInTheDocument();

    expect(container.querySelector("#cotizar")).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "política de tratamiento de datos" }),
    ).toHaveAttribute("href", "/legal/privacidad");
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("envía la cotización con la verificación de persona y muestra el radicado", async () => {
    const sent = serve();
    const user = userEvent.setup();
    await renderRoute("/empresa");

    await fill(user);
    await user.type(
      screen.getByLabelText("Mensaje (opcional)"),
      "Tenemos tres sedes.",
    );
    await user.click(
      screen.getByRole("button", { name: "Pedir la cotización" }),
    );

    const done = await screen.findByRole("heading", {
      name: "Recibimos su solicitud",
    });
    await waitFor(() => expect(done).toHaveFocus());
    expect(screen.getByText("PQR-2026-00042")).toBeInTheDocument();
    expect(sent).toEqual([
      {
        body: {
          name: "Laura Restrepo",
          organization: "Restrepo & Asociados",
          email: "laura@restrepo.co",
          users: 40,
          message: "Tenemos tres sedes.",
        },
        captcha: "solucion-de-prueba",
      },
    ]);
  });

  it("no envía nada con datos incompletos y lleva el foco al primer error", async () => {
    const sent = serve();
    const user = userEvent.setup();
    await renderRoute("/empresa");

    await user.type(screen.getByLabelText("Nombre"), "Laura");
    await user.type(
      screen.getByLabelText("Número aproximado de usuarios"),
      "0",
    );
    await user.click(
      screen.getByRole("button", { name: "Pedir la cotización" }),
    );

    expect(screen.getByLabelText("Firma u oficina")).toHaveFocus();
    expect(
      screen.getByText("Escriba el nombre de la firma u oficina."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Escriba un correo como nombre@firma.com."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Escriba un número entre 1 y 10.000."),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("si se pasó del límite de intentos lo dice", async () => {
    serve(() =>
      jsonResponse({ type: "about:blank", status: 429, detail: "x" }, 429),
    );
    const user = userEvent.setup();
    await renderRoute("/empresa");

    await fill(user);
    await user.click(
      screen.getByRole("button", { name: "Pedir la cotización" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Espere 15 minutos",
    );
  });

  it("si la verificación de persona no pasó, pide esperar e intentar de nuevo", async () => {
    serve(() =>
      jsonResponse({ type: "about:blank", status: 400, detail: "x" }, 400),
    );
    const user = userEvent.setup();
    await renderRoute("/empresa");

    await fill(user);
    await user.click(
      screen.getByRole("button", { name: "Pedir la cotización" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos comprobar que es una persona",
    );
  });
});
