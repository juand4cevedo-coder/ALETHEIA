import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();
const caseId = "01890a5d-ac96-774b-bcce-b302099a8090";
const evidenceId = "01890a5d-ac96-774b-bcce-b302099a8091";
const route = `/app/casos/${caseId}/evidencias/${evidenceId}`;
const api = `/api/v1/cases/${caseId}/evidences/${evidenceId}`;
const sha = "a".repeat(64);
const me = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Laura Gómez",
  email: "laura@example.com",
  email_verified: true,
  organization: {
    id: "01890a5d-ac96-774b-bcce-b302099a8058",
    name: "Ruiz & Asociados",
    role: "lawyer",
    kind: "individual",
  },
  legal: {
    accepted_version: LEGAL_VERSION,
    current_version: LEGAL_VERSION,
    acceptance_required: false,
  },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("presenta huella, origen, sello y eventos paginados de una evidencia", async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    if (url.pathname === "/api/v1/me") return jsonResponse(me);
    if (url.pathname === "/api/v1/auth/refresh") return jsonResponse({}, 401);
    if (url.pathname === api) {
      const older = url.searchParams.get("event_cursor") === "8";
      return jsonResponse({
        id: evidenceId,
        original_filename: "registro.txt",
        declared_type: "document",
        declared_origin: "Entregado por la cliente",
        detected_type: "text/plain",
        sha256: sha,
        size_bytes: 1234,
        tsa_status: "stamped",
        tsa_time: "2026-11-14T15:00:00Z",
        uploaded_at: "2026-11-14T14:00:00Z",
        events: [
          {
            seq: older ? 2 : 8,
            action: older ? "evidence_uploaded" : "evidence_stamped",
            actor_name: older ? "Laura Gómez" : null,
            occurred_at: "2026-11-14T15:00:00Z",
            event_hash: older ? "b".repeat(64) : "c".repeat(64),
          },
        ],
        next_event_seq: older ? null : 8,
      });
    }
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
  await renderRoute(route);
  expect(
    await screen.findByRole("heading", { name: "registro.txt" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Entregado por la cliente")).toBeInTheDocument();
  expect(screen.getByText("Sello obtenido")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Descargar original" }),
  ).toBeVisible();
  expect(screen.getByText(/aaaaaaaa aaaaaaaa aaaaaaaa/)).toBeInTheDocument();
  expect(screen.getByText(/#8: Sello de tiempo obtenido/)).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Ver más eventos" }),
  );
  expect(await screen.findByText(/#2: Evidencia subida/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Ver más eventos" }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Descargar original" }),
  );
  expect(
    await screen.findByText(
      "Su sesión terminó. Ingrese de nuevo para descargar el archivo.",
    ),
  ).toBeInTheDocument();
});

it("no ofrece descargar el original a un asistente", async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    if (url.pathname === "/api/v1/me")
      return jsonResponse({
        ...me,
        organization: {
          ...me.organization,
          role: "assistant",
          kind: "individual",
        },
      });
    if (url.pathname === api)
      return jsonResponse({
        id: evidenceId,
        original_filename: "registro.txt",
        declared_type: "document",
        declared_origin: "Entregado por la cliente",
        detected_type: "text/plain",
        sha256: sha,
        size_bytes: 4,
        tsa_status: "pending",
        tsa_time: null,
        uploaded_at: "2026-11-14T14:00:00Z",
        events: [],
        next_event_seq: null,
      });
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
  await renderRoute(route);
  expect(
    await screen.findByRole("heading", { name: "registro.txt" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Descargar original" }),
  ).not.toBeInTheDocument();
});

it("usa el mismo mensaje para una evidencia inexistente o ajena", async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    if (url.pathname === "/api/v1/me") return jsonResponse(me);
    if (url.pathname === api)
      return jsonResponse({ status: 404, detail: "No encontrado" }, 404);
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
  await renderRoute(route);
  expect(
    await screen.findByText(
      "No encontramos lo que busca o no tiene acceso a ello.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Volver al caso" })).toHaveAttribute(
    "href",
    `/app/casos/${caseId}#evidencias`,
  );
});

it("conserva el detalle y permite reintentar si falla la página siguiente", async () => {
  let nextPageAttempts = 0;
  fetchMock.mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    if (url.pathname === "/api/v1/me") return jsonResponse(me);
    if (url.pathname !== api)
      throw new Error(`Ruta inesperada: ${url.pathname}`);
    if (url.searchParams.has("event_cursor")) {
      nextPageAttempts += 1;
      if (nextPageAttempts === 1)
        return jsonResponse({ status: 404, detail: "No disponible" }, 404);
    }
    return jsonResponse({
      id: evidenceId,
      original_filename: "registro.txt",
      declared_type: "document",
      declared_origin: "Entregado por la cliente",
      detected_type: "text/plain",
      sha256: sha,
      size_bytes: 1234,
      tsa_status: "pending",
      tsa_time: null,
      uploaded_at: "2026-11-14T14:00:00Z",
      events: [
        {
          seq: url.searchParams.has("event_cursor") ? 2 : 8,
          action: "evidence_uploaded",
          actor_name: "Laura Gómez",
          occurred_at: "2026-11-14T15:00:00Z",
          event_hash: "b".repeat(64),
        },
      ],
      next_event_seq: url.searchParams.has("event_cursor") ? null : 8,
    });
  });
  await renderRoute(route);
  expect(
    await screen.findByRole("heading", { name: "registro.txt" }),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Ver más eventos" }),
  );
  expect(
    await screen.findByText(
      "No pudimos cargar más eventos. Inténtelo de nuevo.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "registro.txt" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Entregado por la cliente")).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Ver más eventos" }),
  );
  expect(await screen.findByText(/#2: Evidencia subida/)).toBeInTheDocument();
});

it("crea un enlace para compartir, lo muestra una sola vez y permite revocarlo", async () => {
  let links: unknown[] = [];
  let sent: unknown;
  const link = {
    id: "01890a5d-ac96-774b-bcce-b302099a8201",
    label: "Para el perito",
    created_by_name: "Laura Gómez",
    created_at: "2026-11-23T15:00:00Z",
    expires_at: "2026-11-24T15:00:00Z",
    revoked_at: null,
    status: "active",
    download_count: 0,
    last_downloaded_at: null,
  };
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    if (url.pathname === "/api/v1/me") return jsonResponse(me);
    if (url.pathname === `${api}/share-links`) {
      if (request.method === "POST") {
        sent = await request.json();
        links = [link];
        return jsonResponse(
          { link, url: "https://aletheia.sbs/compartido#t=secreto" },
          201,
        );
      }
      return jsonResponse({ items: links });
    }
    if (url.pathname === `${api}/share-links/${link.id}`) {
      links = [{ ...link, status: "revoked" }];
      return new Response(null, { status: 204 });
    }
    if (url.pathname === api) {
      return jsonResponse({
        id: evidenceId,
        original_filename: "registro.txt",
        declared_type: "document",
        declared_origin: "Entregado por la cliente",
        detected_type: "text/plain",
        sha256: sha,
        size_bytes: 4,
        tsa_status: "pending",
        tsa_time: null,
        uploaded_at: "2026-11-14T14:00:00Z",
        events: [],
        next_event_seq: null,
      });
    }
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const user = userEvent.setup();
  await renderRoute(route);

  await user.click(
    await screen.findByRole("button", { name: "Crear un enlace" }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "Crear un enlace para compartir",
  });
  await user.type(
    within(dialog).getByLabelText("Nota (opcional)"),
    "Para el perito",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Crear el enlace" }),
  );

  const shown = await screen.findByLabelText("Enlace para compartir");
  expect(shown).toHaveValue("https://aletheia.sbs/compartido#t=secreto");
  expect(sent).toEqual({ expires_in_hours: 24, label: "Para el perito" });
  await user.click(screen.getByRole("button", { name: "Listo" }));
  // El enlace completo ya no se vuelve a mostrar.
  expect(screen.queryByDisplayValue(/compartido#t=/)).toBeNull();

  const list = await screen.findByRole("list", {
    name: "Enlaces de esta evidencia",
  });
  expect(within(list).getByText("Para el perito")).toBeInTheDocument();
  await user.click(within(list).getByRole("button", { name: "Revocar" }));
  expect(await screen.findByText("Revocado")).toBeInTheDocument();
});

it("un asistente no ve el panel para compartir", async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    if (url.pathname === "/api/v1/me")
      return jsonResponse({
        ...me,
        organization: {
          ...me.organization,
          role: "assistant",
          kind: "individual",
        },
      });
    if (url.pathname === api)
      return jsonResponse({
        id: evidenceId,
        original_filename: "registro.txt",
        declared_type: "document",
        declared_origin: "Entregado por la cliente",
        detected_type: "text/plain",
        sha256: sha,
        size_bytes: 4,
        tsa_status: "pending",
        tsa_time: null,
        uploaded_at: "2026-11-14T14:00:00Z",
        events: [],
        next_event_seq: null,
      });
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
  await renderRoute(route);
  await screen.findByRole("heading", { name: "registro.txt" });
  expect(screen.queryByText("Compartir con un enlace")).toBeNull();
});
