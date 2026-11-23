import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient.ts";
import { jsonResponse } from "../../test/render.tsx";
import { ClientPortalSection } from "./ClientPortalSection.tsx";

const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8070";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function access(status: "active" | "revoked" = "active") {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8001",
    client_name: "María Pérez",
    client_email: "maria@example.com",
    status,
    created_by_name: "Laura Gómez",
    created_at: "2026-11-22T20:00:00Z",
    expires_at: "2026-12-22T20:00:00Z",
    notice_accepted_at: null,
    last_visit_at: null,
  };
}

function renderPortal(caseOpen = true) {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <ClientPortalSection caseId={CASE_ID} caseOpen={caseOpen} />
    </QueryClientProvider>,
  );
}

function serve(state: {
  accesses: unknown[];
  updates: unknown[];
  messages?: unknown[];
}) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && path.endsWith("/portal/accesses")) {
      const sent = (await request.json()) as {
        client_name: string;
        client_email: string;
      };
      state.accesses = [
        {
          ...access(),
          client_name: sent.client_name,
          client_email: sent.client_email,
        },
      ];
      return jsonResponse(state.accesses[0], 201);
    }
    if (request.method === "POST" && path.endsWith("/portal/updates")) {
      const sent = (await request.json()) as { body: string };
      const created = {
        id: "01890a5d-ac96-774b-bcce-b302099a8002",
        author_name: "Laura Gómez",
        body: sent.body,
        created_at: "2026-11-22T21:00:00Z",
      };
      state.updates = [created];
      return jsonResponse(created, 201);
    }
    if (request.method === "POST" && path.endsWith("/portal/messages/read")) {
      state.messages = (state.messages ?? []).map((item) => ({
        ...(item as object),
        read_at: "2026-11-22T22:00:00Z",
      }));
      return new Response(null, { status: 204 });
    }
    if (path.endsWith("/portal/messages")) {
      const items = state.messages ?? [];
      return jsonResponse({
        items,
        unread_count: items.filter(
          (item) => (item as { read_at: string | null }).read_at === null,
        ).length,
      });
    }
    if (request.method === "DELETE") {
      state.accesses = [access("revoked")];
      return new Response(null, { status: 204 });
    }
    if (path.endsWith("/portal/accesses"))
      return jsonResponse({ items: state.accesses });
    return jsonResponse({ items: state.updates });
  });
}

it("explica qué ve el cliente y que todavía no hay nadie invitado", async () => {
  serve({ accesses: [], updates: [] });
  renderPortal();

  expect(
    await screen.findByText("Todavía no invitó a ningún cliente."),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Todavía no publicó ningún aviso."),
  ).toBeInTheDocument();
  expect(screen.getByText(/nada más/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Enviar invitación" }),
  ).toBeDisabled();
});

it("no envía un correo mal escrito", async () => {
  serve({ accesses: [], updates: [] });
  const user = userEvent.setup();
  renderPortal();
  await screen.findByText("Todavía no invitó a ningún cliente.");

  await user.type(screen.getByLabelText("Nombre del cliente"), "María Pérez");
  await user.type(screen.getByLabelText("Correo del cliente"), "maria");
  await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

  expect(
    await screen.findByText(
      "Escriba un correo válido, por ejemplo nombre@dominio.com.",
    ),
  ).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.filter(
      ([input]) => (input as Request).method === "POST",
    ),
  ).toHaveLength(0);
});

it("invita a un cliente, avisa a dónde llegó el enlace y lo lista", async () => {
  serve({ accesses: [], updates: [] });
  const user = userEvent.setup();
  renderPortal();
  await screen.findByText("Todavía no invitó a ningún cliente.");

  await user.type(screen.getByLabelText("Nombre del cliente"), "María Pérez");
  await user.type(
    screen.getByLabelText("Correo del cliente"),
    "maria@example.com",
  );
  await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

  expect(
    await screen.findByText(/Le enviamos el enlace a maria@example.com/),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("list", { name: "Clientes con acceso" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Aún no acepta el aviso de datos/)).toBeVisible();
});

it("quita el acceso de un cliente", async () => {
  serve({ accesses: [access()], updates: [] });
  const user = userEvent.setup();
  renderPortal();

  await user.click(
    await screen.findByRole("button", { name: "Quitar acceso" }),
  );

  expect(await screen.findByText(/Sin acceso/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Quitar acceso" }),
  ).not.toBeInTheDocument();
});

it("publica un aviso, vacía el campo y lo muestra", async () => {
  serve({ accesses: [], updates: [] });
  const user = userEvent.setup();
  renderPortal();
  await screen.findByText("Todavía no publicó ningún aviso.");

  await user.type(
    screen.getByRole("textbox", { name: "Nuevo aviso" }),
    "Se radicó la demanda",
  );
  await user.click(screen.getByRole("button", { name: "Publicar aviso" }));

  expect(await screen.findByText("Se radicó la demanda")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Nuevo aviso" })).toHaveValue("");
});

it("en un caso archivado conserva lo compartido y no deja invitar ni publicar", async () => {
  serve({ accesses: [access()], updates: [] });
  renderPortal(false);

  expect(await screen.findByText(/El caso está archivado/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Enviar invitación" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Publicar aviso" }),
  ).not.toBeInTheDocument();
});

it("muestra los mensajes de clientes y los marca como leídos al abrir", async () => {
  const state = {
    accesses: [access()],
    updates: [],
    messages: [
      {
        id: "01890a5d-ac96-774b-bcce-b302099a8003",
        client_name: "María Pérez",
        body: "¿Cómo va mi caso?",
        created_at: "2026-11-22T21:30:00Z",
        read_at: null,
      },
    ],
  };
  serve(state);
  renderPortal();

  expect(await screen.findByText("¿Cómo va mi caso?")).toBeInTheDocument();
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          (input as Request).method === "POST" &&
          new URL((input as Request).url).pathname.endsWith(
            "/portal/messages/read",
          ),
      ),
    ).toBe(true),
  );
});

it("sin mensajes de clientes lo dice y explica cómo responder", async () => {
  serve({ accesses: [], updates: [], messages: [] });
  renderPortal();

  expect(
    await screen.findByText(/Todavía no le escribió ningún cliente/),
  ).toBeInTheDocument();
});
