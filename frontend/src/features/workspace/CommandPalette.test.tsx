import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, it } from "vitest";

import type { Me } from "../../api/generated";
import { createQueryClient } from "../../api/queryClient.ts";
import { ROUTES } from "../../config/routes.ts";
import { CommandPalette } from "./CommandPalette.tsx";

const LAWYER = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Laura Gómez",
  email: "laura@example.com",
  email_verified: true,
  platform_admin: false,
  organization: { id: "x", name: "Despacho", role: "lawyer" },
  legal: {
    accepted_version: "x",
    current_version: "x",
    acceptance_required: false,
  },
} as unknown as Me;

function renderPalette() {
  return render(
    <QueryClientProvider
      client={createQueryClient({ queries: { retry: false } })}
    >
      <MemoryRouter initialEntries={[ROUTES.app]}>
        <Routes>
          <Route
            path="*"
            element={<CommandPalette me={LAWYER} open onClose={() => {}} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("ofrece solo las pantallas del rol y filtra sin importar tildes", async () => {
  const user = userEvent.setup();
  renderPalette();
  const box = await screen.findByRole("combobox");

  expect(screen.getByRole("option", { name: /Casos/ })).toBeInTheDocument();
  // La abogada no administra el equipo: no ve Miembros ni la auditoría del despacho.
  expect(screen.queryByRole("option", { name: /Miembros/ })).toBeNull();
  expect(screen.queryByRole("option", { name: /Auditoría/ })).toBeNull();

  await user.type(box, "pedir");
  expect(
    screen.getByRole("option", { name: /Pedir soporte/ }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /Casos/ })).toBeNull();
});

it("se mueve con las flechas y avisa cuando no hay resultados", async () => {
  const user = userEvent.setup();
  renderPalette();
  const box = await screen.findByRole("combobox");
  // El foco se asigna en el siguiente cuadro; se pide aquí para no depender de ese momento.
  await user.click(box);
  await user.keyboard("{ArrowDown}");
  const options = screen.getAllByRole("option");
  expect(options[1]).toHaveAttribute("aria-selected", "true");

  await user.type(box, "zzzz");
  expect(screen.getByText("No encontramos nada con ese texto.")).toBeVisible();
});
