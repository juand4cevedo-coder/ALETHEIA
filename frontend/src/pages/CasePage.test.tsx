import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CaseDetail, CaseTaskOut } from "../api/generated";
import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8090";
const RADICADO = "11001310500320260014300";
const EVENT_HASH = `9f2c71d0b8e4${"0".repeat(48)}a41e`;
const MSG_011 = "No encontramos lo que busca o no tiene acceso a ello.";

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Laura Gómez",
  email: "laura@example.com",
  email_verified: true,
  organization: {
    id: "01890a5d-ac96-774b-bcce-b302099a8058",
    name: "Ruiz & Asociados",
    role: "lawyer",
  },
  legal: {
    accepted_version: LEGAL_VERSION,
    current_version: LEGAL_VERSION,
    acceptance_required: false,
  },
};

const DETAIL: CaseDetail = {
  id: CASE_ID,
  title: "Despido sin justa causa, Torres",
  filing_number: RADICADO,
  court: "Juzgado 3 Laboral del Circuito de Bogotá",
  practice_area: "labor",
  internal_reference: "RA-2026-031",
  status: "open",
  created_at: "2026-11-10T15:32:07Z",
  closed_at: null,
  retention_until: null,
  retention_basis: null,
  legal_hold: false,
  created_by_name: "Laura Gómez",
  member_count: 1,
  members: [
    {
      user_id: ME.id,
      full_name: "Laura Gómez",
      email: "laura@example.com",
      role: "lawyer",
      added_at: "2026-11-10T15:32:07Z",
    },
  ],
  recent_events: [
    {
      seq: 1,
      action: "case_created",
      actor_name: "Laura Gómez",
      occurred_at: "2026-11-10T15:32:07Z",
      event_hash: EVENT_HASH,
    },
  ],
};

const TASK_ID = "01890a5d-ac96-774b-bcce-b302099a8095";
const TASK: CaseTaskOut = {
  id: TASK_ID,
  case_id: CASE_ID,
  title: "Preparar audiencia inicial",
  description: "Consolidar el cuestionario y los anexos necesarios.",
  priority: "high",
  status: "pending",
  due_at: "2026-11-25T19:30:00Z",
  assigned_to: ME.id,
  assignee_name: "Laura Gómez",
  created_by: ME.id,
  created_at: "2026-11-21T14:00:00Z",
  updated_at: "2026-11-21T14:00:00Z",
  completed_at: null,
};

function serve(
  caseResponse: () => Response,
  evidenceResponse: (request: Request) => Response = () =>
    jsonResponse({ items: [], next_cursor: null }),
  custodyResponse: (request: Request) => Response = () =>
    jsonResponse({ items: DETAIL.recent_events, next_cursor: null }),
  verificationResponse: () => Response = () =>
    jsonResponse({
      intact: true,
      events_checked: 1,
      broken_at: null,
      reason: null,
      head_hash: EVENT_HASH,
      latest_anchor: null,
    }),
) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me") return jsonResponse(ME);
    if (request.method === "GET" && path === `/api/v1/cases/${CASE_ID}`) {
      return caseResponse();
    }
    if (
      request.method === "GET" &&
      path === `/api/v1/cases/${CASE_ID}/custody-events`
    ) {
      return custodyResponse(request);
    }
    if (
      request.method === "GET" &&
      path === `/api/v1/cases/${CASE_ID}/custody-verification`
    ) {
      return verificationResponse();
    }
    if (
      request.method === "GET" &&
      path === `/api/v1/cases/${CASE_ID}/evidences`
    ) {
      return evidenceResponse(request);
    }
    if (
      request.method === "GET" &&
      path === `/api/v1/cases/${CASE_ID}/available-members`
    ) {
      return jsonResponse([]);
    }
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
}

async function openCase(state?: { justOpened: boolean }) {
  const rendered = await renderRoute({
    pathname: `/app/casos/${CASE_ID}`,
    state,
  });
  await screen.findByRole("heading", {
    level: 1,
    name: "Despido sin justa causa, Torres",
  });
  return rendered;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Página del caso (HU-015)", () => {
  it("cierra y archiva sin presentar la acción como eliminación", async () => {
    let current = DETAIL;
    serve(() => jsonResponse(current));
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const request = input as Request;
      const path = new URL(request.url).pathname;
      if (
        request.method === "POST" &&
        path === `/api/v1/cases/${CASE_ID}/close`
      ) {
        current = {
          ...DETAIL,
          status: "closed",
          closed_at: "2026-11-20T20:00:00Z",
          retention_until: "2036-11-20T20:00:00Z",
          retention_basis: "organization_policy",
        };
        return jsonResponse(current);
      }
      return original(input, init);
    });
    await openCase();

    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar y archivar" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Cerrar y archivar el caso",
    });
    expect(within(dialog).getByText(/No se borrará ningún dato/)).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar y conservar" }),
    );

    expect(
      await screen.findByText("Caso cerrado y trasladado al archivo."),
    ).toBeVisible();
    expect(screen.getByText("Archivo de casos cerrados")).toBeVisible();
    expect(
      fetchMock.mock.calls.some(
        ([input]) => (input as Request).method === "POST",
      ),
    ).toBe(true);
  });

  it("el asistente consulta el archivo pero no cambia el ciclo de vida", async () => {
    serve(() => jsonResponse(DETAIL));
    const assistant = {
      ...ME,
      organization: { ...ME.organization, role: "assistant" },
    };
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const request = input as Request;
      if (new URL(request.url).pathname === "/api/v1/me") {
        return jsonResponse(assistant);
      }
      return original(input, init);
    });
    await openCase();

    expect(
      screen.queryByRole("button", { name: "Cerrar y archivar" }),
    ).not.toBeInTheDocument();
  });

  it("el propietario gestiona el bloqueo jurídico y el abogado no", async () => {
    let current: CaseDetail = {
      ...DETAIL,
      status: "closed",
      closed_at: "2026-11-20T20:00:00Z",
      retention_until: "2036-11-20T20:00:00Z",
      retention_basis: "organization_policy",
    };
    serve(() => jsonResponse(current));
    const original = fetchMock.getMockImplementation()!;
    const owner = {
      ...ME,
      organization: { ...ME.organization, role: "owner" },
    };
    let sentBody: unknown;
    fetchMock.mockImplementation(async (input, init) => {
      const request = input as Request;
      const path = new URL(request.url).pathname;
      if (path === "/api/v1/me") return jsonResponse(owner);
      if (
        request.method === "PATCH" &&
        path === `/api/v1/cases/${CASE_ID}/retention`
      ) {
        sentBody = await request.json();
        current = {
          ...current,
          legal_hold: true,
          retention_basis: "litigation_hold",
        };
        return jsonResponse(current);
      }
      return original(input, init);
    });
    const user = userEvent.setup();
    await openCase();

    expect(
      screen.getByText("Política del despacho", { selector: "[data-tone]" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Gestionar conservación" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Gestionar conservación",
    });
    await user.selectOptions(
      within(dialog).getByLabelText("Fundamento de conservación"),
      "litigation_hold",
    );
    expect(
      within(dialog).getByText("Activa el bloqueo jurídico del expediente."),
    ).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Guardar y registrar" }),
    );

    expect(sentBody).toEqual({
      legal_hold: true,
      retention_basis: "litigation_hold",
    });
    expect(
      await screen.findByText(
        "Conservación actualizada y registrada en la trazabilidad.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Bloqueo jurídico activo")).toBeVisible();
  });

  it("el abogado ve la conservación pero no puede gestionarla", async () => {
    serve(() =>
      jsonResponse({
        ...DETAIL,
        status: "closed",
        closed_at: "2026-11-20T20:00:00Z",
        retention_until: "2036-11-20T20:00:00Z",
        retention_basis: "organization_policy",
      }),
    );
    await openCase();

    expect(
      screen.getByText("Política del despacho", { selector: "[data-tone]" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Gestionar conservación" }),
    ).not.toBeInTheDocument();
  });

  it("solicita el paquete y muestra el enlace al terminar", async () => {
    serve(() => jsonResponse(DETAIL));
    const original = fetchMock.getMockImplementation()!;
    const exportId = "01890a5d-ac96-774b-bcce-b302099a8099";
    let requested = false;
    fetchMock.mockImplementation(async (input, init) => {
      const request = input as Request;
      const path = new URL(request.url).pathname;
      if (path === `/api/v1/cases/${CASE_ID}/exports`) {
        if (request.method === "POST") {
          requested = true;
          return jsonResponse(
            {
              id: exportId,
              status: "queued",
              created_at: "2026-11-17T15:00:00Z",
              expires_at: null,
              download_url: null,
            },
            202,
          );
        }
        return jsonResponse({
          items: requested
            ? [
                {
                  id: exportId,
                  status: "ready",
                  created_at: "2026-11-17T15:00:00Z",
                  expires_at: "2026-11-18T15:00:00Z",
                  download_url:
                    "https://aletheia.sbs/descargar-paquete#t=token",
                  requested_by_name: "Laura Gómez",
                  manifest_sha256: "c".repeat(64),
                },
              ]
            : [],
        });
      }
      return original(input, init);
    });
    await openCase();
    await userEvent.click(screen.getByRole("tab", { name: "Paquete" }));
    expect(
      await screen.findByText(/Todavía no se ha solicitado ningún paquete/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Solicitar paquete" }),
    );

    expect(
      await screen.findByRole("link", { name: "Abrir descarga" }),
    ).toHaveAttribute("href", "https://aletheia.sbs/descargar-paquete#t=token");
    expect(screen.getByText(/Pedido por Laura Gómez/)).toBeInTheDocument();
    expect(screen.getByText("Listo")).toBeInTheDocument();
  });

  it("muestra el radicado por bloques, el título y los chips de especialidad, despacho y apertura", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase();

    const filing = screen.getByText("11001 31 05 003 2026 00143 00");
    expect(filing).toHaveAttribute("translate", "no");
    const chips = screen.getByRole("list", { name: "Datos del caso" });
    expect(within(chips).getByText("Laboral")).toBeInTheDocument();
    expect(
      within(chips).getByText("Juzgado 3 Laboral del Circuito de Bogotá"),
    ).toBeInTheDocument();
    expect(
      within(chips).getByText(
        /^Abierto el 10 de noviembre de 2026 a las 10:32 a\. m\. por Laura Gómez$/,
      ),
    ).toBeInTheDocument();
  });

  it("muestra el evento 1 con su huella completa y la hora de Colombia", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase();

    const tab = screen.getByRole("tab", { name: /Cadena de custodia/ });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toHaveTextContent("1");
    const panel = screen.getByRole("tabpanel", { name: /Cadena de custodia/ });
    // La navegación por encabezados encuentra la cadena aunque su título no se vea.
    expect(
      within(panel).getByRole("heading", {
        level: 2,
        name: "Cadena de custodia",
      }),
    ).toBeInTheDocument();
    const event = await within(panel).findByRole("listitem", {
      name: /Evento 1/,
    });
    expect(within(event).getByText("Caso creado")).toBeInTheDocument();
    const time = within(event).getByText(
      /10:32:07 a\. m\. \(hora de Colombia\)$/,
    );
    expect(time).toHaveAttribute("datetime", "2026-11-10T15:32:07Z");
    expect(time.parentElement).toHaveTextContent(/^Laura Gómez, /);
    // La huella se ve completa, en bloques de 8, y se puede copiar.
    const blocks = EVENT_HASH.toLowerCase()
      .match(/.{1,8}/g)!
      .join(" ");
    const hash = within(event).getByText(blocks);
    expect(hash.closest("[translate='no']")).not.toBeNull();
    expect(
      within(event).getByRole("button", { name: "Copiar huella" }),
    ).toBeInTheDocument();
    // El primer evento no tiene anterior: el detalle lo dice.
    expect(
      within(event).getByText("Ver el detalle del evento"),
    ).toBeInTheDocument();
  });

  it("carga los eventos anteriores en orden sin permitir modificarlos", async () => {
    const user = userEvent.setup();
    const events = [1, 2, 3].map((seq) => ({
      seq,
      action: seq === 1 ? "case_created" : "member_added",
      actor_name: "Laura Gómez",
      occurred_at: "2026-11-10T15:32:07Z",
      event_hash: EVENT_HASH,
    }));
    serve(
      () =>
        jsonResponse({ ...DETAIL, recent_events: events.slice(1).reverse() }),
      undefined,
      (request) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        return cursor === "2"
          ? jsonResponse({ items: [events[0]], next_cursor: null })
          : jsonResponse({ items: events.slice(1).reverse(), next_cursor: 2 });
      },
    );
    await openCase();
    await screen.findByRole("listitem", { name: "Evento 3" });
    await user.click(
      screen.getByRole("button", { name: "Ver eventos anteriores" }),
    );
    await screen.findByRole("listitem", { name: "Evento 1" });
    expect(
      within(screen.getByRole("list", { name: "Eventos de la cadena" }))
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("aria-label")),
    ).toEqual(["Evento 1", "Evento 2", "Evento 3"]);
    expect(
      screen.queryByRole("button", { name: "Ver eventos anteriores" }),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls
        .map(([input]) => input as Request)
        .filter((request) =>
          new URL(request.url).pathname.endsWith("/custody-events"),
        )
        .every((request) => request.method === "GET"),
    ).toBe(true);
  });

  it("comprueba la cadena y muestra el primer evento alterado", async () => {
    const user = userEvent.setup();
    serve(
      () => jsonResponse(DETAIL),
      undefined,
      undefined,
      () =>
        jsonResponse({
          intact: false,
          events_checked: 0,
          broken_at: 1,
          reason: "event_hash",
          head_hash: "0".repeat(64),
          latest_anchor: null,
        }),
    );
    await openCase();
    await screen.findByText("Sin verificar");
    await user.click(screen.getByRole("button", { name: "Verificar cadena" }));
    expect(await screen.findByText("Cadena alterada")).toBeInTheDocument();
    expect(
      screen.getByText(/^La cadena no cierra en el evento #1/),
    ).toBeInTheDocument();
  });

  it("solo afirma integridad después del recálculo", async () => {
    const user = userEvent.setup();
    serve(() => jsonResponse(DETAIL));
    await openCase();
    await screen.findByText("Sin verificar");
    await user.click(screen.getByRole("button", { name: "Verificar cadena" }));
    expect(
      await screen.findByText("Integridad comprobada"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no incluye un anclaje externo/),
    ).toBeInTheDocument();
  });

  it("muestra hasta qué evento llega el anclaje externo", async () => {
    const user = userEvent.setup();
    serve(
      () => jsonResponse(DETAIL),
      undefined,
      undefined,
      () =>
        jsonResponse({
          intact: true,
          events_checked: 1,
          broken_at: null,
          reason: null,
          head_hash: EVENT_HASH,
          latest_anchor: {
            seq: 1,
            head_hash: EVENT_HASH,
            tsa_time: "2026-11-21T17:30:00Z",
          },
        }),
    );
    await openCase();
    await screen.findByText("Sin verificar");
    await user.click(screen.getByRole("button", { name: "Verificar cadena" }));
    expect(
      await screen.findByText(/anclaje externo cubre la cabeza actual/),
    ).toBeInTheDocument();
    expect(screen.getByText(/hasta el evento #1/)).toBeInTheDocument();
  });

  it("muestra el equipo con quien abrió el caso", async () => {
    serve(() => jsonResponse(DETAIL));
    const user = userEvent.setup();
    await openCase();

    const teamTab = screen.getByRole("tab", { name: /Equipo/ });
    expect(teamTab).toHaveTextContent("1");
    await user.click(screen.getByRole("tab", { name: /Cadena de custodia/ }));
    await user.keyboard("{ArrowRight}");
    expect(teamTab).toHaveAttribute("aria-selected", "true");
    expect(teamTab).toHaveFocus();

    const panel = screen.getByRole("tabpanel", { name: /Equipo/ });
    const member = within(panel).getByRole("listitem");
    expect(within(member).getByText("Laura Gómez")).toBeInTheDocument();
    expect(within(member).getByText("laura@example.com")).toBeInTheDocument();
    expect(within(member).getByText("Abogado")).toBeInTheDocument();
    expect(within(member).getByText("Abrió el caso")).toBeInTheDocument();
  });

  it("el abogado crea y asigna tareas con plazo y prioridad", async () => {
    const user = userEvent.setup();
    let tasks: CaseTaskOut[] = [];
    let sentBody: unknown;
    serve(() => jsonResponse(DETAIL));
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const request = input as Request;
      const path = new URL(request.url).pathname;
      if (path === `/api/v1/cases/${CASE_ID}/tasks`) {
        if (request.method === "GET") {
          return jsonResponse({ items: tasks, next_cursor: null });
        }
        if (request.method === "POST") {
          sentBody = await request.json();
          tasks = [{ ...TASK, ...(sentBody as object) }];
          return jsonResponse(tasks[0], 201);
        }
      }
      return original(input, init);
    });

    await openCase();
    await user.click(screen.getByRole("tab", { name: "Tareas y plazos" }));
    expect(
      await screen.findByText("Este caso todavía no tiene tareas asignadas."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Nueva tarea" }));
    const dialog = screen.getByRole("dialog", {
      name: "Nueva tarea del caso",
    });
    await user.type(within(dialog).getByLabelText("Tarea"), TASK.title);
    await user.type(
      within(dialog).getByLabelText("Instrucciones"),
      TASK.description!,
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Prioridad"),
      "high",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Crear y asignar" }),
    );

    expect(sentBody).toEqual({
      title: TASK.title,
      description: TASK.description,
      priority: "high",
      assigned_to: ME.id,
      due_at: null,
    });
    expect(await screen.findByText(TASK.title)).toBeVisible();
    expect(screen.getByText("Prioridad alta")).toBeVisible();
  });

  it("el abogado crea de una vez las tareas de una plantilla", async () => {
    const user = userEvent.setup();
    let sentBody: unknown;
    serve(() => jsonResponse(DETAIL));
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const request = input as Request;
      const path = new URL(request.url).pathname;
      if (path === `/api/v1/cases/${CASE_ID}/tasks`) {
        return jsonResponse({ items: [], next_cursor: null });
      }
      if (path === "/api/v1/task-templates") {
        return jsonResponse({
          items: [
            {
              id: "01890a5d-ac96-774b-bcce-b302099a8101",
              name: "Proceso laboral",
              created_at: "2026-11-23T12:00:00Z",
              items: [
                {
                  title: "Radicar la demanda",
                  description: null,
                  priority: "high",
                  due_days: 3,
                },
              ],
            },
          ],
        });
      }
      if (path === `/api/v1/cases/${CASE_ID}/tasks/from-template`) {
        sentBody = await request.json();
        return jsonResponse({ tasks: [] }, 201);
      }
      return original(input, init);
    });

    await openCase();
    await user.click(screen.getByRole("tab", { name: "Tareas y plazos" }));
    await user.click(
      await screen.findByRole("button", { name: "Usar una plantilla" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Crear tareas desde una plantilla",
    });
    expect(within(dialog).getByText(/Se crearán 1 tarea/)).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Crear las tareas" }),
    );

    expect(sentBody).toEqual({
      template_id: "01890a5d-ac96-774b-bcce-b302099a8101",
      assigned_to: ME.id,
    });
  });

  it("el asistente completa solo su tarea y no puede crearla ni cancelarla", async () => {
    const user = userEvent.setup();
    let current = TASK;
    let sentBody: unknown;
    const assistant = {
      ...ME,
      organization: { ...ME.organization, role: "assistant" },
    };
    serve(() => jsonResponse(DETAIL));
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const request = input as Request;
      const path = new URL(request.url).pathname;
      if (path === "/api/v1/me") return jsonResponse(assistant);
      if (
        request.method === "GET" &&
        path === `/api/v1/cases/${CASE_ID}/tasks`
      ) {
        return jsonResponse({ items: [current], next_cursor: null });
      }
      if (
        request.method === "PATCH" &&
        path === `/api/v1/cases/${CASE_ID}/tasks/${TASK_ID}/status`
      ) {
        sentBody = await request.json();
        current = {
          ...current,
          status: "completed",
          completed_at: "2026-11-21T15:00:00Z",
          updated_at: "2026-11-21T15:00:00Z",
        };
        return jsonResponse(current);
      }
      return original(input, init);
    });

    await openCase();
    await user.click(screen.getByRole("tab", { name: "Tareas y plazos" }));
    expect(await screen.findByText(TASK.title)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Nueva tarea" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar tarea" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Completar" }));

    expect(sentBody).toEqual({ status: "completed" });
    expect(
      await within(
        screen.getByRole("list", { name: "Tareas del caso" }),
      ).findByText("Completada"),
    ).toBeVisible();
  });

  it("filtra tareas en el servidor y conserva el historial cerrado en consulta", async () => {
    const user = userEvent.setup();
    const closed: CaseDetail = {
      ...DETAIL,
      status: "closed",
      closed_at: "2026-11-20T20:00:00Z",
      retention_until: "2036-11-20T20:00:00Z",
      retention_basis: "organization_policy",
    };
    const requests: URL[] = [];
    serve(() => jsonResponse(closed));
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const request = input as Request;
      const url = new URL(request.url);
      if (
        request.method === "GET" &&
        url.pathname === `/api/v1/cases/${CASE_ID}/tasks`
      ) {
        requests.push(url);
        return jsonResponse({ items: [TASK], next_cursor: null });
      }
      return original(input, init);
    });

    await openCase();
    await user.click(screen.getByRole("tab", { name: "Tareas y plazos" }));
    expect(await screen.findByText(TASK.title)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Nueva tarea" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Completar" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Buscar tarea"), "audiencia");
    await user.selectOptions(screen.getByLabelText("Estado"), "pending");
    await user.selectOptions(screen.getByLabelText("Persona asignada"), ME.id);
    await waitFor(() => {
      expect(
        requests.some(
          (url) =>
            url.searchParams.get("search") === "audiencia" &&
            url.searchParams.get("status") === "pending" &&
            url.searchParams.get("assigned_to") === ME.id,
        ),
      ).toBe(true);
    });
  });

  it("asigna y retira a una persona del caso sin quitarla del despacho", async () => {
    const user = userEvent.setup();
    const teammate = {
      user_id: "01890a5d-ac96-774b-bcce-b302099a8091",
      full_name: "Sofía Ruiz",
      email: "sofia@example.com",
      role: "assistant",
      added_at: "2026-11-14T15:00:00Z",
    };
    let assigned = false;
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      const path = new URL(request.url).pathname;
      if (path === "/api/v1/me") return jsonResponse(ME);
      if (path === `/api/v1/cases/${CASE_ID}` && request.method === "GET") {
        return jsonResponse({
          ...DETAIL,
          member_count: assigned ? 2 : 1,
          members: assigned ? [...DETAIL.members, teammate] : DETAIL.members,
        });
      }
      if (path === `/api/v1/cases/${CASE_ID}/available-members`) {
        return jsonResponse(assigned ? [] : [teammate]);
      }
      if (
        path === `/api/v1/cases/${CASE_ID}/members` &&
        request.method === "POST"
      ) {
        expect(await request.json()).toEqual({ user_id: teammate.user_id });
        assigned = true;
        return new Response(null, { status: 204 });
      }
      if (
        path === `/api/v1/cases/${CASE_ID}/members/${teammate.user_id}` &&
        request.method === "DELETE"
      ) {
        assigned = false;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Ruta inesperada: ${request.method} ${path}`);
    });

    await openCase();
    await user.click(screen.getByRole("tab", { name: /Equipo/ }));
    await screen.findByRole("option", { name: /Sofía Ruiz/ });
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Agregar a una persona del despacho",
      }),
      teammate.user_id,
    );
    await user.click(screen.getByRole("button", { name: "Asignar al caso" }));
    expect(await screen.findByText("Sofía Ruiz")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Retirar a Sofía Ruiz del caso/ }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await screen.findByText(
      "Persona retirada del caso. Sigue perteneciendo al despacho.",
    );
    expect(screen.queryByText("Sofía Ruiz")).not.toBeInTheDocument();
  });

  it("no muestra «Editar datos», «Subir evidencia» ni «Verificar ahora»", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase();

    for (const name of [
      /Editar datos/,
      /Subir evidencia/,
      /Verificar ahora/,
      /Paquetes/,
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
      expect(screen.queryByRole("link", { name })).toBeNull();
      expect(screen.queryByRole("tab", { name })).toBeNull();
    }
    expect(screen.queryByText(/Cadena íntegra/)).toBeNull();
    expect(await screen.findByText("Sin verificar")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Evidencias" })).toBeInTheDocument();
  });

  it("muestra el origen como declaración y el tipo detectado del contenido", async () => {
    serve(
      () => jsonResponse(DETAIL),
      () =>
        jsonResponse({
          items: [
            {
              id: "01890a5d-ac96-774b-bcce-b302099a8092",
              original_filename: "registro.pdf",
              declared_type: "document",
              declared_origin: "Entregado por la cliente",
              detected_type: "text/plain",
              sha256: "a".repeat(64),
              size_bytes: 120,
              tsa_status: "pending",
              uploaded_at: "2026-11-14T15:00:00Z",
            },
          ],
          next_cursor: null,
        }),
    );
    await openCase();
    await userEvent
      .setup()
      .click(screen.getByRole("tab", { name: "Evidencias" }));

    const panel = screen.getByRole("tabpanel", { name: "Evidencias" });
    expect(
      await within(panel).findByText("Entregado por la cliente"),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Texto plano")).toBeInTheDocument();
    expect(
      within(panel).getByText(/El origen es una declaración/),
    ).toBeInTheDocument();
  });

  it("continúa la lista desde el cursor de la página anterior", async () => {
    const firstId = "01890a5d-ac96-774b-bcce-b302099a8092";
    const secondId = "01890a5d-ac96-774b-bcce-b302099a8091";
    const item = (id: string, filename: string) => ({
      id,
      original_filename: filename,
      declared_type: "document",
      declared_origin: "Cliente",
      detected_type: "text/plain",
      sha256: "a".repeat(64),
      size_bytes: 120,
      tsa_status: "pending",
      uploaded_at: "2026-11-14T15:00:00Z",
    });
    serve(
      () => jsonResponse(DETAIL),
      (request) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        return cursor === firstId
          ? jsonResponse({
              items: [item(secondId, "segundo.txt")],
              next_cursor: null,
            })
          : jsonResponse({
              items: [item(firstId, "primero.txt")],
              next_cursor: firstId,
            });
      },
    );
    await openCase();
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Evidencias" }));
    expect(await screen.findByText("primero.txt")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Ver más evidencias" }),
    );
    expect(await screen.findByText("segundo.txt")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver más evidencias" }),
    ).toBeNull();
  });

  it("al llegar recién abierto anuncia «Caso abierto. Su cadena de custodia comenzó.»", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase({ justOpened: true });

    const notice = screen
      .getByText("Caso abierto. Su cadena de custodia comenzó.")
      .closest("[role='status']");
    expect(notice).not.toBeNull();
  });

  it("el aviso de recién abierto se muestra una vez y no vuelve al recargar", async () => {
    serve(() => jsonResponse(DETAIL));
    const { router } = await openCase({ justOpened: true });

    // El estado se borra del historial: recargar o volver atrás no repite el aviso.
    await waitFor(() => {
      expect(router.state.location.state).toBeNull();
    });
    expect(router.state.location.pathname).toBe(`/app/casos/${CASE_ID}`);
    expect(
      screen.getAllByText("Caso abierto. Su cadena de custodia comenzó."),
    ).toHaveLength(1);
  });

  it("sin el estado de recién abierto no muestra el aviso", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase();

    expect(
      screen.queryByText("Caso abierto. Su cadena de custodia comenzó."),
    ).toBeNull();
  });

  it("un caso sin radicado ni especialidad no inventa esos datos", async () => {
    serve(() =>
      jsonResponse({
        ...DETAIL,
        filing_number: null,
        practice_area: null,
        court: null,
      }),
    );
    await openCase();

    const reference = screen.getByText(/^Sin radicado, referencia interna/);
    expect(reference).toHaveTextContent(
      "Sin radicado, referencia interna RA-2026-031",
    );
    expect(within(reference).getByText("RA-2026-031")).toHaveAttribute(
      "translate",
      "no",
    );
    const chips = screen.getByRole("list", { name: "Datos del caso" });
    expect(within(chips).getAllByRole("listitem")).toHaveLength(1);
  });

  it("el estado del caso no usa el verde reservado a la verificación", async () => {
    serve(() => jsonResponse(DETAIL));
    const { container } = await openCase();

    const badge = screen.getByText("Abierto").closest("[data-tone]");
    expect(badge).toHaveAttribute("data-tone", "muted");
    // Ningún elemento de la página lleva el tono verde por defecto.
    expect(container.querySelector("[data-tone='ok']")).toBeNull();
  });

  it("un caso que no existe muestra MSG-011", async () => {
    serve(() =>
      jsonResponse(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: MSG_011,
        },
        404,
      ),
    );
    await renderRoute(`/app/casos/${CASE_ID}`);

    expect(await screen.findByText(MSG_011)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Caso no disponible" }),
    ).toBeInTheDocument();
    // Quien buscaba un caso vuelve a la lista de casos, no al inicio.
    expect(
      screen.getByRole("link", { name: "Volver a los casos" }),
    ).toHaveAttribute("href", "/app/casos");
    expect(
      screen.queryByRole("link", { name: "Volver al inicio" }),
    ).not.toBeInTheDocument();
  });

  it("un id mal formado también muestra MSG-011 y no un error del sistema", async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = new URL((input as Request).url).pathname;
      if (path === "/api/v1/me") return jsonResponse(ME);
      return jsonResponse(
        { type: "about:blank", title: "Unprocessable", status: 422 },
        422,
      );
    });
    await renderRoute("/app/casos/no-es-un-id");

    expect(await screen.findByText(MSG_011)).toBeInTheDocument();
  });

  it("sin violaciones de axe", async () => {
    serve(() => jsonResponse(DETAIL));
    const user = userEvent.setup();
    const { container } = await openCase({ justOpened: true });

    expect(await seriousAxeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("tab", { name: /Equipo/ }));
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
