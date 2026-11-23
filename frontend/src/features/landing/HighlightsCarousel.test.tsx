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
      name: "Cada responsabilidad, con su fecha y su responsable.",
    }),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /2 de 5: Evidencias/ }));
  expect(
    screen.getByRole("heading", {
      level: 3,
      name: "Cada archivo conserva su huella y su origen.",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Revisar cómo se protege/ }),
  ).toHaveAttribute("href", "/seguridad");

  const pause = screen.getByRole("button", { name: "Pausar" });
  await user.click(pause);
  expect(screen.getByRole("button", { name: "Reanudar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await seriousAxeViolations(container)).toEqual([]);
});
