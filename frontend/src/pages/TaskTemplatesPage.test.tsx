import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

function me(role: "owner" | "lawyer" | "assistant") {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Ana Restrepo",
    email: "ana@example.com",
    email_verified: true,
    organization: {
      id: "01890a5d-ac96-774b-bcce-b302099a8058",
      name: "Restrepo Abogados",
      role,
      kind: "individual",
    },
    legal: {
      accepted_version: LEGAL_VERSION,
      current_version: LEGAL_VERSION,
      acceptance_required: false,
    },
  };
}

const TEMPLATE = {
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
    {
      title: "Archivar soportes",
      description: null,
      priority: "normal",
      due_days: null,
    },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("lista las plantillas del despacho con sus tareas y plazos", async () => {
  fetchMock.mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    if (path === "/api/v1/me") return jsonResponse(me("lawyer"));
    if (path === "/api/v1/task-templates") {
      return jsonResponse({ items: [TEMPLATE] });
    }
    throw new Error(`Ruta inesperada: ${path}`);
  });
  await renderRoute("/app/plantillas");

  expect(
    await screen.findByRole("heading", { name: "Proceso laboral" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Radicar la demanda")).toBeInTheDocument();
  expect(screen.getByText(/Alta, 3 días después/)).toBeInTheDocument();
  expect(screen.getByText(/Normal, Sin plazo/)).toBeInTheDocument();
});

it("crea una plantilla con su primera tarea", async () => {
  let sent: unknown;
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me") return jsonResponse(me("owner"));
    if (path === "/api/v1/task-templates" && request.method === "POST") {
      sent = await request.json();
      return jsonResponse(TEMPLATE, 201);
    }
    if (path === "/api/v1/task-templates") return jsonResponse({ items: [] });
    throw new Error(`Ruta inesperada: ${path}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/plantillas");

  await user.type(
    await screen.findByLabelText("Nombre de la plantilla"),
    "Proceso laboral",
  );
  await user.type(screen.getByLabelText("Tarea 1"), "Radicar la demanda");
  await user.selectOptions(screen.getByLabelText("Plazo"), "3");
  await user.click(screen.getByRole("button", { name: "Guardar plantilla" }));

  await vi.waitFor(() =>
    expect(sent).toEqual({
      name: "Proceso laboral",
      items: [{ title: "Radicar la demanda", priority: "normal", due_days: 3 }],
    }),
  );
});

it("un asistente no entra a las plantillas", async () => {
  fetchMock.mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    if (path === "/api/v1/me") return jsonResponse(me("assistant"));
    throw new Error(`Ruta inesperada: ${path}`);
  });
  const { router } = await renderRoute("/app/plantillas");

  await vi.waitFor(() => expect(router.state.location.pathname).toBe("/app"));
});

it("edita una plantilla: carga sus tareas, cambia una y guarda el reemplazo", async () => {
  let sent: unknown;
  let target = "";
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me") return jsonResponse(me("lawyer"));
    if (path === "/api/v1/task-templates" && request.method === "GET") {
      return jsonResponse({ items: [TEMPLATE] });
    }
    if (
      path.startsWith("/api/v1/task-templates/") &&
      request.method === "PUT"
    ) {
      target = path;
      sent = await request.json();
      return jsonResponse(TEMPLATE);
    }
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/plantillas");

  await user.click(await screen.findByRole("button", { name: "Editar" }));
  // El formulario arranca con lo que ya tiene la plantilla.
  // Hay dos formularios: el de plantilla nueva arriba y el de edición en la tarjeta.
  const firstTask = screen.getAllByLabelText("Tarea 1")[1]!;
  expect(firstTask).toHaveValue("Radicar la demanda");
  expect(screen.getAllByLabelText("Nombre de la plantilla")[1]).toHaveValue(
    "Proceso laboral",
  );
  await user.clear(firstTask);
  await user.type(firstTask, "Radicar con poder");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

  await vi.waitFor(() =>
    expect(target).toBe(`/api/v1/task-templates/${TEMPLATE.id}`),
  );
  expect(sent).toEqual({
    name: "Proceso laboral",
    items: [
      { title: "Radicar con poder", priority: "high", due_days: 3 },
      { title: "Archivar soportes", priority: "normal", due_days: null },
    ],
  });
});
