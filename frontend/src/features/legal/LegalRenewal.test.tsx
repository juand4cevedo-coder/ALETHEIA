import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADER } from "../../api/runtimeConfig.ts";
import { LEGAL_VERSION } from "../../config/legal.ts";
import { LEGAL_PAGES } from "../../config/routes.ts";
import { seriousAxeViolations } from "../../test/axe.ts";
import { jsonResponse, renderRoute } from "../../test/render.tsx";
import {
  isLegalAcceptanceRequired,
  LEGAL_ACCEPTANCE_REQUIRED,
} from "./acceptance.ts";
import { LEGAL_CHANGES } from "./changes.ts";

const fetchMock = vi.fn<typeof fetch>();

function me(acceptanceRequired: boolean) {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Ana María Restrepo",
    email: "ana@example.com",
    email_verified: true,
    organization: {
      id: "01890a5d-ac96-774b-bcce-b302099a8058",
      name: "Restrepo Abogados",
      role: "owner",
    },
    legal: {
      accepted_version: acceptanceRequired ? "2026-11-02" : LEGAL_VERSION,
      current_version: LEGAL_VERSION,
      acceptance_required: acceptanceRequired,
    },
  };
}

function acceptanceRequests(): Request[] {
  return fetchMock.mock.calls
    .map(([input]) => input as Request)
    .filter((request) => request.url.endsWith("/api/v1/me/legal-acceptance"));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // jsdom no trae matchMedia; con movimiento reducido la pantalla no anima nada.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as unknown as MediaQueryList),
  );
});

describe("Textos legales nuevos por aceptar (TT-012)", () => {
  it("cada fecha de los textos vigentes tiene su resumen de cambios", () => {
    expect(LEGAL_CHANGES[LEGAL_VERSION]?.length).toBeGreaterThan(0);
  });

  it("reemplaza el espacio de trabajo, dice qué cambió y abre cada texto completo", async () => {
    fetchMock.mockResolvedValue(jsonResponse(me(true)));
    const { container } = await renderRoute("/app");

    const title = await screen.findByRole("heading", {
      level: 1,
      name: "Actualizamos nuestros textos legales",
    });
    // El foco va al título para anunciar por qué cambió la pantalla.
    expect(title).toHaveFocus();
    expect(screen.getByText(/^Ana, antes de seguir/)).toBeInTheDocument();
    // El espacio de trabajo no se muestra.
    expect(
      screen.queryByRole("heading", { name: "Ana María Restrepo" }),
    ).not.toBeInTheDocument();

    const cambios = screen.getByRole("heading", {
      name: "Qué cambió",
    }).parentElement!;
    expect(within(cambios).getAllByRole("listitem")).toHaveLength(
      LEGAL_CHANGES[LEGAL_VERSION]!.length,
    );

    const textos = screen.getByRole("navigation", { name: "Textos completos" });
    const enlaces = within(textos).getAllByRole("link");
    expect(enlaces).toHaveLength(LEGAL_PAGES.length);
    for (const enlace of enlaces) {
      expect(enlace).toHaveAttribute("target", "_blank");
      expect(enlace).toHaveAttribute("rel", "noopener");
    }

    // La casilla nunca viene marcada: la aceptación no se presume.
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("sin marcar la casilla no envía nada y lo pide", async () => {
    fetchMock.mockResolvedValue(jsonResponse(me(true)));
    const user = userEvent.setup();
    await renderRoute("/app");

    await user.click(
      await screen.findByRole("button", {
        name: "Aceptar los textos vigentes",
      }),
    );

    expect(
      screen.getByText("Marque la casilla para aceptar los textos vigentes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveFocus();
    expect(acceptanceRequests()).toHaveLength(0);
  });

  it("al aceptar envía la versión vigente y abre el espacio de trabajo", async () => {
    let accepted = false;
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      if (request.url.endsWith("/api/v1/me/legal-acceptance")) {
        accepted = true;
        return new Response(null, { status: 204 });
      }
      return jsonResponse(me(!accepted));
    });
    const user = userEvent.setup();
    await renderRoute("/app");

    await user.click(await screen.findByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Aceptar los textos vigentes" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Ana María Restrepo",
      }),
    ).toBeInTheDocument();
    const [request] = acceptanceRequests();
    expect(request!.method).toBe("POST");
    expect(request!.headers.get(SAME_ORIGIN_HEADER)).toBe("1");
    expect(await request!.json()).toEqual({
      legal_version: LEGAL_VERSION,
      accepts_legal_terms: true,
    });
  });

  it("si los textos cambiaron mientras los leía, pide recargar", async () => {
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      if (request.url.endsWith("/api/v1/me/legal-acceptance")) {
        return jsonResponse(
          { type: "about:blank", title: "Conflict", status: 409 },
          409,
        );
      }
      return jsonResponse(me(true));
    });
    const user = userEvent.setup();
    await renderRoute("/app");

    await user.click(await screen.findByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Aceptar los textos vigentes" }),
    );

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Los textos cambiaron mientras los leía");
    expect(
      within(alerta).getByRole("button", { name: "Recargar la página" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(alerta).toHaveFocus());
  });

  it("reconoce el 403 de textos sin aceptar y no lo confunde con otro 403", () => {
    expect(
      isLegalAcceptanceRequired({
        type: LEGAL_ACCEPTANCE_REQUIRED,
        title: "Forbidden",
        status: 403,
      }),
    ).toBe(true);
    expect(
      isLegalAcceptanceRequired({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
      }),
    ).toBe(false);
    expect(isLegalAcceptanceRequired(new Error("red"))).toBe(false);
  });
});

describe("Salir sin aceptar (HU-009, ADR-032)", () => {
  it("deja cerrar la sesión sin aceptar los textos", async () => {
    let alive = true;
    fetchMock.mockImplementation(async (input) => {
      const path = new URL((input as Request).url).pathname;
      if (path === "/api/v1/auth/logout") {
        alive = false;
        return new Response(null, { status: 204 });
      }
      if (path === "/api/v1/me" && alive) return jsonResponse(me(true));
      return jsonResponse({ type: "about:blank", status: 401 }, 401);
    });
    const user = userEvent.setup();
    const { router } = await renderRoute("/app");

    await user.click(
      await screen.findByRole("button", {
        name: "Cerrar la sesión y revisarlos después",
      }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/ingresar"),
    );
    expect(acceptanceRequests()).toHaveLength(0);
    expect(
      await screen.findByText("Cerró la sesión en este dispositivo."),
    ).toBeInTheDocument();
  });
});
