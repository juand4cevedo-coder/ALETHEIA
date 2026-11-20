import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/generated";
import { createQueryClient } from "../../api/queryClient.ts";
import { ROUTES } from "../../config/routes.ts";
import { WorkspaceNav } from "./WorkspaceNav.tsx";

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Ana Restrepo",
  email: "ana@example.com",
  email_verified: true,
  platform_admin: true,
  organization: null,
  legal: {
    accepted_version: "x",
    current_version: "x",
    acceptance_required: false,
  },
} as unknown as Me;

// jsdom no calcula diseño: se simula una franja de 375 px con 1 200 px de contenido, donde el
// enlace activo (aria-current) queda al final, a 900 px del inicio y con 100 px de ancho.
function simulateStrip() {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(375);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const active = this.getAttribute("aria-current") === "page";
      return {
        left: active ? 900 : 0,
        width: active ? 100 : 375,
      } as DOMRect;
    },
  );
}

afterEach(() => vi.restoreAllMocks());

function renderNav(path: string) {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <WorkspaceNav me={ME} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Franja de navegación en celular", () => {
  it("centra el enlace activo desplazando solo la franja", () => {
    simulateStrip();
    renderNav(ROUTES.platformAudit);
    const nav = screen.getByRole("navigation", { name: "Espacio de trabajo" });
    // 900 desde el inicio, menos (375 - 100) / 2 de margen a cada lado.
    expect(nav.scrollLeft).toBe(900 - (375 - 100) / 2);
    expect(window.scrollY).toBe(0);
  });

  it("no hace nada si ninguna ruta coincide", () => {
    simulateStrip();
    renderNav("/app/ruta-que-no-existe");
    const nav = screen.getByRole("navigation", { name: "Espacio de trabajo" });
    expect(nav.scrollLeft).toBe(0);
  });

  it("no desplaza nada cuando la franja cabe entera", () => {
    simulateStrip();
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(375);
    renderNav(ROUTES.platformAudit);
    const nav = screen.getByRole("navigation", { name: "Espacio de trabajo" });
    expect(nav.scrollLeft).toBe(0);
  });
});
