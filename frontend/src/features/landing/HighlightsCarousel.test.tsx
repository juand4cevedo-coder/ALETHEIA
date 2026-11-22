import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";

import { seriousAxeViolations } from "../../test/axe.ts";
import { HighlightsCarousel } from "./HighlightsCarousel.tsx";

it("permite cambiar de capacidad y pausar el avance", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <MemoryRouter>
      <HighlightsCarousel />
    </MemoryRouter>,
  );

  expect(
    screen.getByRole("heading", {
      level: 3,
      name: "Vea el estado de su práctica sin reconstruirlo a mano.",
    }),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /2 de 5: Casos/ }));
  expect(
    screen.getByRole("heading", {
      level: 3,
      name: "Cada asunto conserva su identidad y su recorrido.",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Conocer la gestión de casos/ }),
  ).toHaveAttribute("href", "/docs/crear-un-caso");

  const pause = screen.getByRole("button", { name: "Pausar" });
  await user.click(pause);
  expect(screen.getByRole("button", { name: "Reanudar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await seriousAxeViolations(container)).toEqual([]);
});
