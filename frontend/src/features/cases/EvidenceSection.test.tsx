import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient.ts";
import { seriousAxeViolations } from "../../test/axe.ts";
import { jsonResponse } from "../../test/render.tsx";
import { EvidenceSection } from "./EvidenceSection.tsx";

const fetchMock = vi.fn<typeof fetch>();
const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8070";

function evidence(
  id: string,
  name: string,
  status: "pending" | "stamped" | "failed",
  type: "chat" | "document" = "document",
  size = 2048,
) {
  return {
    id,
    original_filename: name,
    declared_type: type,
    declared_origin: "Entregado por el cliente",
    detected_type: "application/pdf",
    sha256: id.slice(-1).repeat(64),
    size_bytes: size,
    tsa_status: status,
    uploaded_at: "2026-11-22T15:00:00Z",
  };
}

const ITEMS = [
  evidence(
    "01890a5d-ac96-774b-bcce-b302099a8001",
    "Contrato firmado.pdf",
    "stamped",
  ),
  evidence(
    "01890a5d-ac96-774b-bcce-b302099a8002",
    "Chat con la clienta.txt",
    "pending",
    "chat",
    1024,
  ),
  evidence(
    "01890a5d-ac96-774b-bcce-b302099a8003",
    "Acta de audiencia.pdf",
    "failed",
  ),
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async () =>
    jsonResponse({ items: ITEMS, next_cursor: null }),
  );
});

function renderSection() {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <MemoryRouter>
        <EvidenceSection caseId={CASE_ID} canUpload={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("resume el total, el espacio y el estado de los sellos", async () => {
  const { container } = renderSection();

  const summary = (await screen.findByText("3 archivos")).parentElement!;
  expect(summary).toHaveTextContent("3 archivos");
  expect(summary).toHaveTextContent("5 KB en total");
  expect(summary).toHaveTextContent("1 con sello obtenido");
  expect(summary).toHaveTextContent("1 con sello pendiente");
  expect(summary).toHaveTextContent("1 con sello fallido");
  expect(await seriousAxeViolations(container)).toEqual([]);
});

it("cada archivo muestra el estado de su sello y su huella", async () => {
  renderSection();

  const list = await screen.findByRole("list", { name: "Evidencias del caso" });
  const items = within(list).getAllByRole("listitem");
  expect(within(items[0]!).getByText("Sello obtenido")).toBeInTheDocument();
  expect(within(items[1]!).getByText("Sello pendiente")).toBeInTheDocument();
  expect(within(items[2]!).getByText("Sello fallido")).toBeInTheDocument();
  expect(within(items[0]!).getByText("Huella SHA-256")).toBeInTheDocument();
});

it("filtra por sello, por tipo y por nombre sin distinguir acentos", async () => {
  const user = userEvent.setup();
  renderSection();
  await screen.findByRole("list", { name: "Evidencias del caso" });

  await user.click(
    within(
      screen.getByRole("group", { name: "Filtrar por sello de tiempo" }),
    ).getByRole("button", { name: /Sello fallido/ }),
  );
  let names = within(screen.getByRole("list", { name: "Evidencias del caso" }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
  expect(names).toEqual(["Acta de audiencia.pdf"]);

  await user.click(
    within(
      screen.getByRole("group", { name: "Filtrar por sello de tiempo" }),
    ).getByRole("button", { name: /Todas/ }),
  );
  await user.click(
    within(screen.getByRole("group", { name: "Filtrar por tipo" })).getByRole(
      "button",
      { name: "Conversación" },
    ),
  );
  names = within(screen.getByRole("list", { name: "Evidencias del caso" }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
  expect(names).toEqual(["Chat con la clienta.txt"]);

  await user.click(
    within(screen.getByRole("group", { name: "Filtrar por tipo" })).getByRole(
      "button",
      { name: "Todos los tipos" },
    ),
  );
  await user.type(
    screen.getByLabelText("Buscar por nombre de archivo"),
    "AUDIENCIA",
  );
  names = within(screen.getByRole("list", { name: "Evidencias del caso" }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
  expect(names).toEqual(["Acta de audiencia.pdf"]);

  await user.clear(screen.getByLabelText("Buscar por nombre de archivo"));
  await user.type(screen.getByLabelText("Buscar por nombre de archivo"), "zzz");
  expect(
    screen.getByText(/Ninguna evidencia cargada coincide con el filtro/),
  ).toBeInTheDocument();
});
