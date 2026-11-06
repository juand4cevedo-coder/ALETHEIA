import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Ana Restrepo",
  email: "ana@example.com",
  email_verified: false,
  organization: {
    id: "01890a5d-ac96-774b-bcce-b302099a8058",
    name: "Restrepo Abogados",
    role: "lawyer",
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

describe("Espacio de trabajo protegido (API-014)", () => {
  it("sin sesión lleva a ingresar y recuerda la pantalla pedida", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { type: "about:blank", title: "Unauthorized", status: 401 },
        401,
      ),
    );
    const { router } = await renderRoute("/app");

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/ingresar"),
    );
    expect(router.state.location.state).toEqual({ from: "/app" });
  });

  it("con sesión muestra a la persona, su organización, su rol y el estado del correo", async () => {
    fetchMock.mockResolvedValue(jsonResponse(ME));
    const { container } = await renderRoute("/app");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ana Restrepo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Restrepo Abogados · Abogado")).toBeInTheDocument();
    expect(screen.getByText("Sin verificar")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Verifique su correo" }),
    ).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("si el servidor falla, lo dice y deja reintentar", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ type: "about:blank", title: "Error", status: 503 }, 503),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...ME, email_verified: true }),
    );
    await renderRoute("/app");

    const reintentar = await screen.findByRole("button", {
      name: "Intentar de nuevo",
    });
    reintentar.click();

    expect(await screen.findByText("Verificado")).toBeInTheDocument();
  });
});
