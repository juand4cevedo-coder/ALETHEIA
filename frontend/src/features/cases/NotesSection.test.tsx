import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient.ts";
import { jsonResponse } from "../../test/render.tsx";
import { NotesSection } from "./NotesSection.tsx";

const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8070";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function note(id: string, body: string, author = "Laura Gómez") {
  return {
    id,
    case_id: CASE_ID,
    author_id: "01890a5d-ac96-774b-bcce-b302099a8057",
    author_name: author,
    body,
    created_at: "2026-11-22T20:00:00Z",
  };
}

function renderNotes(caseOpen = true) {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <NotesSection caseId={CASE_ID} caseOpen={caseOpen} />
    </QueryClientProvider>,
  );
}

it("explica qué son las notas cuando el caso todavía no tiene ninguna", async () => {
  fetchMock.mockImplementation(async () =>
    jsonResponse({ items: [], next_cursor: null }),
  );
  renderNotes();
  expect(await screen.findByText("Todavía no hay notas.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Agregar nota" })).toBeDisabled();
});

it("agrega una nota, vacía el campo y vuelve a leer la lista", async () => {
  const items = [note("n1", "Primera nota")];
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method === "POST") {
      const sent = (await request.json()) as { body: string };
      items.unshift(note("n2", sent.body));
      return jsonResponse(items[0]!, 201);
    }
    return jsonResponse({ items, next_cursor: null });
  });
  const user = userEvent.setup();
  renderNotes();
  expect(await screen.findByText("Primera nota")).toBeInTheDocument();

  const box = screen.getByRole("textbox", { name: "Nueva nota" });
  await user.type(box, "Cliente confirmó la fecha");
  expect(screen.getByText("25 de 4000")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Agregar nota" }));

  expect(
    await screen.findByText("Cliente confirmó la fecha"),
  ).toBeInTheDocument();
  await waitFor(() => expect(box).toHaveValue(""));
  const post = fetchMock.mock.calls.find(
    ([input]) => (input as Request).method === "POST",
  );
  expect(new URL((post![0] as Request).url).pathname).toBe(
    `/api/v1/cases/${CASE_ID}/notes`,
  );
});

it("en un caso archivado muestra las notas sin ofrecer escribir otra", async () => {
  fetchMock.mockImplementation(async () =>
    jsonResponse({ items: [note("n1", "Nota conservada")], next_cursor: null }),
  );
  renderNotes(false);
  expect(await screen.findByText("Nota conservada")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText(/El caso está archivado/)).toBeInTheDocument();
});
