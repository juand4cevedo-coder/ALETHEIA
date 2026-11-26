import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../../config/legal.ts";
import { jsonResponse, renderRoute } from "../../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();
const ADMIN_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const ORG_ID = "01890a5d-ac96-774b-bcce-b302099a8070";

function organization(kind: "individual" | "firm") {
  return {
    id: ORG_ID,
    name: kind === "firm" ? "Restrepo Abogados" : "Laura Gómez",
    kind,
    status: "active",
    owner_name: "Laura Gómez",
    owner_email: "laura@example.com",
    members: kind === "firm" ? 3 : 1,
    plan_name: "Profesional",
    subscription_status: "active",
    access_source: "payment",
    billing_cycle: "monthly",
    ends_at: "2026-12-25T00:00:00Z",
    storage_used_bytes: 0,
    storage_limit_bytes: null,
    created_at: "2026-11-01T15:00:00Z",
  };
}

function serve() {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    if (url.pathname === "/api/v1/me")
      return jsonResponse({
        id: ADMIN_ID,
        full_name: "Ana Restrepo",
        email: "ana@example.com",
        email_verified: true,
        platform_admin: true,
        permissions: ["platform.manage"],
        organization: null,
        legal: {
          accepted_version: LEGAL_VERSION,
          current_version: LEGAL_VERSION,
          acceptance_required: false,
        },
      });
    if (url.pathname === "/api/v1/platform/organizations")
      return jsonResponse({
        items: [
          organization(
            url.searchParams.get("kind") === "individual"
              ? "individual"
              : "firm",
          ),
        ],
        next_cursor: null,
        total: 1,
      });
    if (
      url.pathname === `/api/v1/platform/organizations/${ORG_ID}/deletion` &&
      request.method === "POST"
    )
      return new Response(null, { status: 204 });
    return jsonResponse({ detail: "No encontrado" }, 404);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  serve();
});

it("dice si cada despacho es independiente o firma y filtra por tipo", async () => {
  const user = userEvent.setup();
  await renderRoute("/app/plataforma/despachos");

  const fila = (await screen.findByText("Restrepo Abogados")).closest("tr")!;
  expect(within(fila).getByText("Firma")).toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("Tipo"), "individual");
  await user.click(screen.getByRole("button", { name: "Buscar" }));

  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([input]) =>
        new URL((input as Request).url).search.includes("kind=individual"),
      ),
    ).toBe(true),
  );
  expect(await screen.findByText("Independiente")).toBeInTheDocument();
});

it("elimina un despacho solo después de escribir su nombre exacto", async () => {
  const user = userEvent.setup();
  await renderRoute("/app/plataforma/despachos");

  await user.click(
    await screen.findByRole("button", {
      name: "Eliminar el despacho Restrepo Abogados",
    }),
  );
  const confirm = screen.getByRole("button", { name: "Eliminar para siempre" });
  const campo = screen.getByLabelText(
    "Para confirmar, escriba el nombre del despacho",
  );
  expect(confirm).toBeDisabled();
  await user.type(campo, "Otro despacho");
  expect(confirm).toBeDisabled();
  await user.clear(campo);
  await user.type(campo, "restrepo abogados");
  expect(confirm).toBeEnabled();
  await user.click(confirm);

  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const request = input as Request;
        return (
          request.method === "POST" &&
          new URL(request.url).pathname ===
            `/api/v1/platform/organizations/${ORG_ID}/deletion`
        );
      }),
    ).toBe(true),
  );
});
