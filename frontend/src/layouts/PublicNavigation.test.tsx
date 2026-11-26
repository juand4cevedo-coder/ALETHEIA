import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { PublicNavigation } from "./PublicNavigation.tsx";
import { seriousAxeViolations } from "../test/axe.ts";

it("ofrece cinco opciones y cambia el panel con el puntero", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PublicNavigation />
    </MemoryRouter>,
  );
  const nav = screen.getByRole("navigation", { name: "Principal" });
  expect(within(nav).getAllByRole("button")).toHaveLength(4);
  expect(within(nav).getByRole("link", { name: "Precios" })).toHaveAttribute(
    "href",
    "/precios",
  );
  await user.hover(screen.getByRole("button", { name: "Producto" }));
  expect(
    await screen.findByRole("link", {
      name: /Gestión de casos/,
    }),
  ).toHaveAttribute("href", "/#como-le-ayuda");
  await user.hover(screen.getByRole("button", { name: "Recursos" }));
  expect(screen.queryByText("Gestión de casos")).not.toBeInTheDocument();
  expect(
    await screen.findByRole("link", { name: /Documentación/ }),
  ).toHaveAttribute("href", "/docs/introduccion");
  fireEvent.pointerDown(document.body);
  expect(screen.getByRole("button", { name: "Recursos" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it("mantiene el panel al primer clic del ratón y lo cierra al segundo", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PublicNavigation />
    </MemoryRouter>,
  );
  const trigger = screen.getByRole("button", { name: "Producto" });
  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.unhover(trigger);
  await user.hover(trigger);
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("permite entrar al panel con el teclado y regresar al disparador con Escape", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <MemoryRouter>
      <PublicNavigation />
    </MemoryRouter>,
  );
  const product = screen.getByRole("button", { name: "Producto" });
  product.focus();
  await user.keyboard("{Enter}{ArrowRight}");
  const teams = screen.getByRole("button", { name: "Equipos" });
  expect(teams).toHaveFocus();
  expect(teams).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{ArrowDown}");
  await screen.findByRole("link", { name: /Para firmas jurídicas/ });
  // El foco del primer enlace se aplica en el próximo frame, después de montar el panel.
  const { waitFor } = await import("@testing-library/react");
  await waitFor(() =>
    expect(
      screen.getByRole("link", { name: /Para firmas jurídicas/ }),
    ).toHaveFocus(),
  );
  await user.keyboard("{Escape}");
  expect(teams).toHaveFocus();
  expect(teams).toHaveAttribute("aria-expanded", "false");
  expect(await seriousAxeViolations(container)).toEqual([]);
});
