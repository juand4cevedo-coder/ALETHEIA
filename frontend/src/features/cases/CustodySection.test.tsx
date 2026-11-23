import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient.ts";
import { seriousAxeViolations } from "../../test/axe.ts";
import { jsonResponse } from "../../test/render.tsx";
import { CustodySection } from "./CustodySection.tsx";

const fetchMock = vi.fn<typeof fetch>();
const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8070";
const EVIDENCE_ID = "01890a5d-ac96-774b-bcce-b302099a8071";
const H1 = "1".repeat(64);
const H2 = "2".repeat(64);
const H3 = "3".repeat(64);
const ZERO = "0".repeat(64);
const BLOCKS = (digit: string) => `${digit.repeat(8)} `.repeat(8).trim();

const EVENTS = [
  {
    seq: 3,
    action: "evidence_stamped",
    actor_name: null,
    occurred_at: "2026-11-22T15:00:00Z",
    event_hash: H3,
    prev_hash: H2,
    evidence_id: EVIDENCE_ID,
    details: { tsa_time: "2026-11-22T15:00:00Z" },
  },
  {
    seq: 2,
    action: "evidence_uploaded",
    actor_name: "Laura Gómez",
    occurred_at: "2026-11-22T14:00:00Z",
    event_hash: H2,
    prev_hash: H1,
    evidence_id: EVIDENCE_ID,
    details: { sha256: "a".repeat(64), size_bytes: 2048 },
  },
  {
    seq: 1,
    action: "case_created",
    actor_name: "Laura Gómez",
    occurred_at: "2026-11-22T13:00:00Z",
    event_hash: H1,
    prev_hash: ZERO,
    evidence_id: null,
    details: {},
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname;
    if (path.endsWith("/custody-verification"))
      return jsonResponse({
        intact: true,
        events_checked: 3,
        broken_at: null,
        reason: null,
        head_hash: H3,
        latest_anchor: null,
      });
    return jsonResponse({ items: EVENTS, next_cursor: null });
  });
});

function renderSection() {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <MemoryRouter>
        <CustodySection caseId={CASE_ID} justOpened={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("resume la cadena con su cabeza completa y el botón de verificar", async () => {
  const { container } = renderSection();

  const summary = await screen.findByRole("region", {
    name: "Resumen de la cadena",
  });
  expect(
    within(summary).getByText("Huella de la cabeza de la cadena"),
  ).toBeInTheDocument();
  expect(within(summary).getByText(BLOCKS("3"))).toBeInTheDocument();
  expect(
    within(summary).getByRole("button", { name: "Verificar cadena" }),
  ).toBeInTheDocument();
  expect(await seriousAxeViolations(container)).toEqual([]);
});

it("filtra por tipo de evento y cuenta cada grupo", async () => {
  const user = userEvent.setup();
  renderSection();
  await screen.findByRole("list", { name: "Eventos de la cadena" });

  const filters = screen.getByRole("group", { name: "Mostrar eventos de" });
  expect(
    within(filters).getByRole("button", { name: /Sello de tiempo\s*1/ }),
  ).toBeInTheDocument();
  expect(
    within(filters).queryByRole("button", { name: /Paquetes/ }),
  ).not.toBeInTheDocument();

  await user.click(
    within(filters).getByRole("button", { name: /Sello de tiempo/ }),
  );

  const items = within(
    screen.getByRole("list", { name: "Eventos de la cadena" }),
  ).getAllByRole("listitem");
  expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
    "Evento 3",
  ]);
  expect(screen.queryByText("Siguiente eslabón")).not.toBeInTheDocument();
});

it("el detalle muestra la huella anterior y sus datos, y el primer evento dice que no tiene anterior", async () => {
  const user = userEvent.setup();
  renderSection();
  const upload = await screen.findByRole("listitem", { name: "Evento 2" });

  await user.click(within(upload).getByText("Ver el detalle del evento"));

  expect(within(upload).getByText("Evento anterior")).toBeInTheDocument();
  expect(within(upload).getByText(BLOCKS("1"))).toBeInTheDocument();
  expect(within(upload).getByText("Huella del archivo")).toBeInTheDocument();
  expect(within(upload).getByText("2 KB")).toBeInTheDocument();
  expect(
    within(upload).getByRole("link", { name: "Abrir la evidencia" }),
  ).toHaveAttribute("href", `/app/casos/${CASE_ID}/evidencias/${EVIDENCE_ID}`);

  const first = screen.getByRole("listitem", { name: "Evento 1" });
  await user.click(within(first).getByText("Ver el detalle del evento"));
  expect(
    within(first).getByText(/Es el primer evento de la cadena/),
  ).toBeInTheDocument();
});

it("verifica la cadena y muestra el resultado", async () => {
  const user = userEvent.setup();
  renderSection();

  await user.click(
    await screen.findByRole("button", { name: "Verificar cadena" }),
  );

  expect(await screen.findByText("Integridad comprobada")).toBeInTheDocument();
});
