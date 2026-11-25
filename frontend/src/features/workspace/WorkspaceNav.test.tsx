import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import type { Me } from "../../api/generated";
import { createQueryClient } from "../../api/queryClient.ts";
import { BROWSER_STORAGE } from "../../config/browserStorage.ts";
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

beforeEach(() => window.localStorage.clear());

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

describe("Menú lateral del espacio de trabajo", () => {
  it("agrupa la consola de la plataforma en secciones con nombre", () => {
    renderNav(ROUTES.platform);
    const nav = screen.getByRole("navigation", { name: "Espacio de trabajo" });
    for (const group of ["Plataforma", "Clientes", "Comercial", "Operación"])
      expect(within(nav).getByRole("button", { name: group })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    expect(within(nav).getByRole("link", { name: "Resumen" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("pliega un grupo, lo recuerda y deja sus enlaces fuera del foco", async () => {
    const user = userEvent.setup();
    renderNav(ROUTES.platform);
    await user.click(screen.getByRole("button", { name: "Comercial" }));

    expect(screen.getByRole("button", { name: "Comercial" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.getByRole("link", { name: "Ingresos" }).closest("[inert]"),
    ).not.toBeNull();
    expect(
      JSON.parse(
        window.localStorage.getItem(BROWSER_STORAGE.navigation.key) ?? "{}",
      ),
    ).toMatchObject({ folded: ["comercial"] });
  });

  it("el modo compacto conserva el nombre accesible de cada enlace", async () => {
    const user = userEvent.setup();
    renderNav(ROUTES.platformAudit);
    await user.click(screen.getByRole("button", { name: "Compactar el menú" }));

    expect(
      screen.getByRole("button", { name: "Expandir el menú" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Auditoría" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
