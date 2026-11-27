import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InboxOut } from "../../api/generated";
import { createQueryClient } from "../../api/queryClient.ts";
import { jsonResponse } from "../../test/render.tsx";
import { seriousAxeViolations } from "../../test/axe.ts";
import { NotificationBell } from "./NotificationBell.tsx";
import { timeAgo } from "./timeAgo.ts";

const fetchMock = vi.fn<typeof fetch>();
const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8070";
const ID = "01890a5d-ac96-774b-bcce-b302099a8071";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function inbox(changes: Partial<InboxOut> = {}): InboxOut {
  return {
    unread: 1,
    items: [
      {
        id: ID,
        kind: "task_assigned",
        title: "Nueva tarea en Sucesión Gómez",
        body: "Preparar cronología",
        link: `/app/casos/${CASE_ID}#tareas`,
        read: false,
        created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
    ],
    ...changes,
  };
}

function renderBell() {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route path="/app" element={<NotificationBell />} />
          <Route path="/app/casos/:caseId" element={<p>Caso abierto</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationBell", () => {
  it("muestra cuántos avisos faltan por leer y los abre en un panel", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith("/read")) return new Response(null, { status: 204 });
      return jsonResponse(inbox());
    });
    const user = userEvent.setup();
    const { container } = renderBell();

    const bell = await screen.findByRole("button", {
      name: "Avisos, 1 sin leer",
    });
    await user.click(bell);

    expect(bell).toHaveAttribute("aria-expanded", "true");
    const item = screen.getByRole("link", {
      name: /Nueva tarea en Sucesión Gómez/,
    });
    expect(item).toHaveTextContent("Preparar cronología");
    expect(item).toHaveTextContent("Hace 5 minutos");
    expect(await seriousAxeViolations(container)).toEqual([]);

    await user.click(item);
    expect(await screen.findByText("Caso abierto")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input instanceof Request ? input.url : input).endsWith(
            `/notifications/${ID}/read`,
          ),
        ),
      ).toBe(true),
    );
  });

  it("sin avisos dice que está al día", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], unread: 0 }));
    const user = userEvent.setup();
    renderBell();

    await user.click(
      await screen.findByRole("button", {
        name: "Avisos, no tiene avisos sin leer",
      }),
    );

    expect(await screen.findByText("Está al día")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Marcar todo como leído" }),
    ).not.toBeInTheDocument();
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-27T15:00:00Z");

  it("dice el tiempo en palabras y, pasada una semana, la fecha", () => {
    expect(timeAgo("2026-11-27T14:59:30Z", now)).toBe("Hace un momento");
    expect(timeAgo("2026-11-27T13:00:00Z", now)).toBe("Hace 2 horas");
    expect(timeAgo("2026-11-26T15:00:00Z", now)).toBe("Ayer");
    expect(timeAgo("2026-11-01T15:00:00Z", now)).toBe("1 de nov");
  });
});
