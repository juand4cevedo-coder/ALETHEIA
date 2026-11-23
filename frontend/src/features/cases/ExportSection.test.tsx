import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient.ts";
import { seriousAxeViolations } from "../../test/axe.ts";
import { jsonResponse } from "../../test/render.tsx";
import { ExportSection } from "./ExportSection.tsx";

const fetchMock = vi.fn<typeof fetch>();
const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8070";

function item(
  id: string,
  status: "queued" | "building" | "ready" | "expired" | "failed",
) {
  return {
    id: `01890a5d-ac96-774b-bcce-b302099a80${id}`,
    status,
    created_at: "2026-11-22T15:00:00Z",
    expires_at: status === "ready" ? "2026-11-23T15:00:00Z" : null,
    download_url:
      status === "ready" ? "https://aletheia.sbs/descargar-paquete#t=a" : null,
    requested_by_name: "Laura Gómez",
    manifest_sha256: status === "ready" ? "d".repeat(64) : null,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function renderSection() {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <ExportSection caseId={CASE_ID} />
    </QueryClientProvider>,
  );
}

it("explica qué incluye el paquete y lista el historial con el estado de cada uno", async () => {
  fetchMock.mockImplementation(async () =>
    jsonResponse({
      items: [item("10", "ready"), item("11", "expired"), item("12", "failed")],
    }),
  );
  const { container } = renderSection();

  const contents = screen.getByRole("list", { name: "Qué incluye el paquete" });
  expect(within(contents).getAllByRole("listitem")).toHaveLength(4);
  const list = await screen.findByRole("list", { name: "Paquetes del caso" });
  const rows = within(list).getAllByRole("listitem");
  expect(within(rows[0]!).getByText("Listo")).toBeInTheDocument();
  expect(
    within(rows[0]!).getByRole("link", { name: "Abrir descarga" }),
  ).toBeInTheDocument();
  expect(
    within(rows[0]!).getByText("Huella del manifiesto"),
  ).toBeInTheDocument();
  expect(within(rows[1]!).getByText("Enlace vencido")).toBeInTheDocument();
  expect(
    within(rows[1]!).queryByRole("link", { name: "Abrir descarga" }),
  ).not.toBeInTheDocument();
  expect(within(rows[2]!).getByText("Falló")).toBeInTheDocument();
  expect(await seriousAxeViolations(container)).toEqual([]);
});

it("mientras un paquete se prepara no deja pedir otro", async () => {
  fetchMock.mockImplementation(async () =>
    jsonResponse({ items: [item("13", "building")] }),
  );
  renderSection();

  expect(await screen.findByText("Preparando el paquete.")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Solicitar paquete" }),
  ).toBeDisabled();
});
