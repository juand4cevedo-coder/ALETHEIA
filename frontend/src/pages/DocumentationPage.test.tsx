import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { renderRoute } from "../test/render.tsx";
import { seriousAxeViolations } from "../test/axe.ts";

it("busca guías sin depender de acentos y abre sus pasos e índice", async () => {
  const user = userEvent.setup();
  const { container } = await renderRoute("/docs");
  expect(
    screen.getByRole("heading", { level: 1, name: "Introducción" }),
  ).toBeInTheDocument();
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar documentación" }),
    "verificar",
  );
  const nav = screen.getByRole("navigation", { name: "Documentación" });
  expect(within(nav).getAllByRole("link")).toHaveLength(1);
  await user.click(
    within(nav).getByRole("link", {
      name: "Verificar un archivo con su manifiesto",
    }),
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Verificar un archivo con su manifiesto",
  );
  expect(
    screen.getByRole("navigation", { name: "En esta página" }),
  ).toHaveTextContent("Interprete el resultado");
  expect(
    screen.getByText(/La comparación no verifica quién creó el archivo/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Abrir el verificador" }),
  ).toHaveAttribute("href", "/verificador");
  expect(await seriousAxeViolations(container)).toEqual([]);
});

it("muestra una búsqueda vacía y una página desconocida sin inventar contenido", async () => {
  const user = userEvent.setup();
  const { unmount } = await renderRoute("/docs");
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar documentación" }),
    "inexistente",
  );
  expect(
    within(screen.getByRole("navigation", { name: "Documentación" })).getByRole(
      "status",
    ),
  ).toHaveTextContent("No encontramos esa guía");
  unmount();
  await renderRoute("/docs/inexistente");
  expect(
    screen.queryByRole("navigation", { name: "En esta página" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
});
