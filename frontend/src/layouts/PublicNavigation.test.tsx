import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { PublicNavigation } from "./PublicNavigation.tsx";
import { seriousAxeViolations } from "../test/axe.ts";

it("ofrece siete opciones y cambia el panel con el puntero", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PublicNavigation />
    </MemoryRouter>,
  );
  const nav = screen.getByRole("navigation", { name: "Principal" });
  expect(within(nav).getAllByRole("button")).toHaveLength(6);
  expect(within(nav).getByRole("link", { name: "Precios" })).toHaveAttribute(
    "href",
    "/precios",
  );
  await user.hover(screen.getByRole("button", { name: "Producto" }));
  expect(
    screen.getByRole("link", {
      name: /Gestión de casos/,
    }),
  ).toHaveAttribute("href", "/#como-funciona");
  await user.hover(screen.getByRole("button", { name: "Docs" }));
  expect(screen.queryByText("Gestión de casos")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Introducción/ })).toHaveAttribute(
    "href",
    "/docs",
  );
  fireEvent.pointerDown(document.body);
  expect(screen.getByRole("button", { name: "Docs" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
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
  const company = screen.getByRole("button", { name: "Compañía" });
  expect(company).toHaveFocus();
  expect(company).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{ArrowDown}");
  await screen.findByRole("link", { name: "Sobre Aletheia" });
  // El foco del primer enlace se aplica en el próximo frame, después de montar el panel.
  const { waitFor } = await import("@testing-library/react");
  await waitFor(() =>
    expect(screen.getByRole("link", { name: "Sobre Aletheia" })).toHaveFocus(),
  );
  await user.keyboard("{Escape}");
  expect(company).toHaveFocus();
  expect(company).toHaveAttribute("aria-expanded", "false");
  expect(await seriousAxeViolations(container)).toEqual([]);
});
