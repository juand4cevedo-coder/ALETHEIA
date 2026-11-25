import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../../config/legal.ts";
import { jsonResponse, renderRoute } from "../../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function me(platformAdmin: boolean) {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Ana Restrepo",
    email: "ana@example.com",
    email_verified: true,
    platform_admin: platformAdmin,
    permissions: platformAdmin ? ["platform.manage"] : [],
    organization: null,
    legal: {
      accepted_version: LEGAL_VERSION,
      current_version: LEGAL_VERSION,
      acceptance_required: false,
    },
  };
}

it("no consulta las mediciones sin el cargo de plataforma", async () => {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    if (new URL(request.url).pathname === "/api/v1/me")
      return jsonResponse(me(false));
    throw new Error(`Ruta inesperada: ${request.method} ${request.url}`);
  });

  await renderRoute("/app/plataforma/rendimiento");

  expect(
    await screen.findByText("Esta cuenta no administra la plataforma."),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("muestra el percentil 75 por versión y pide la ventana elegida", async () => {
  const days: string[] = [];
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    if (url.pathname === "/api/v1/me") return jsonResponse(me(true));
    if (url.pathname === "/api/v1/platform/web-vitals") {
      days.push(url.searchParams.get("days") ?? "");
      return jsonResponse({
        days: Number(url.searchParams.get("days")),
        total_samples: 1234,
        rows: [
          {
            version: "0.19.3",
            device: "movil",
            metric: "LCP",
            samples: 400,
            p75: 2650,
            good_share: 0.62,
            rating: "needs-improvement",
          },
          {
            version: "0.19.3",
            device: "movil",
            metric: "CLS",
            samples: 400,
            p75: 0.0123,
            good_share: 0.98,
            rating: "good",
          },
        ],
      });
    }
    throw new Error(`Ruta inesperada: ${request.method} ${request.url}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/plataforma/rendimiento");

  const lcp = (
    await screen.findByRole("heading", {
      name: "¿Cuánto tarda en verse lo principal?",
    })
  ).closest("article")!;
  expect(within(lcp).getByText("2,65 s")).toBeInTheDocument();
  expect(within(lcp).getByText("Por mejorar")).toBeInTheDocument();
  expect(
    within(lcp).getByRole("meter", { name: "Visitas en el umbral bueno" }),
  ).toHaveAttribute("aria-valuetext", "62 %");
  const cls = screen
    .getByRole("heading", { name: "¿Se mueve la página mientras carga?" })
    .closest("article")!;
  expect(within(cls).getByText("0,012")).toBeInTheDocument();
  expect(screen.getByText(/1\.234 medidas/)).toBeInTheDocument();
  expect(days).toEqual(["14"]);

  await user.click(screen.getByRole("radio", { name: "30 días" }));

  await screen.findByText(/en los últimos 30 días/);
  expect(days).toContain("30");
});

it("explica cómo aparecen las medidas cuando todavía no hay ninguna", async () => {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me") return jsonResponse(me(true));
    if (path === "/api/v1/platform/web-vitals")
      return jsonResponse({ days: 14, total_samples: 0, rows: [] });
    throw new Error(`Ruta inesperada: ${request.method} ${request.url}`);
  });

  await renderRoute("/app/plataforma/rendimiento");

  expect(
    await screen.findByText(/Todavía no hay medidas en este periodo/),
  ).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
