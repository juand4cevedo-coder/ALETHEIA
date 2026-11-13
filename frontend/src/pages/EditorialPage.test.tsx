import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { jsonResponse, renderRoute } from "../test/render.tsx";
import { seriousAxeViolations } from "../test/axe.ts";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("filtra el blog por categoría y búsqueda sin depender de acentos", async () => {
  const user = userEvent.setup();
  const { container } = await renderRoute("/blog");
  expect(
    within(screen.getByRole("main")).getAllByRole("heading", { level: 2 }),
  ).toHaveLength(3);
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar artículos" }),
    "huella",
  );
  expect(
    screen.getByRole("heading", {
      name: "Qué dice una huella digital. Y qué no.",
    }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Práctica" }));
  expect(screen.getByText("No encontramos ese tema")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Ver todos los artículos" }),
  );
  expect(
    within(screen.getByRole("main")).getAllByRole("heading", { level: 2 }),
  ).toHaveLength(3);
  expect(await seriousAxeViolations(container)).toEqual([]);
});

it("el artículo conserva el alcance de la comparación", async () => {
  await renderRoute("/blog/que-dice-una-huella-sha256");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Qué dice una huella digital.",
  );
  expect(screen.getByText(/No identifica al autor/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("el estado solo confirma salud cuando la API y la base responden correctamente", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ status: "ok", database: "ok" }))
    .mockResolvedValueOnce(jsonResponse({ status: "error" }, 503));
  const user = userEvent.setup();
  await renderRoute("/estado");
  expect(await screen.findByText("El servicio responde")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/health",
    expect.objectContaining({ cache: "no-store", credentials: "omit" }),
  );
  await user.click(screen.getByRole("button", { name: "Comprobar de nuevo" }));
  expect(
    await screen.findByText("No pudimos confirmar la conexión"),
  ).toBeInTheDocument();
  expect(screen.queryByText("El servicio responde")).not.toBeInTheDocument();
});

it("un fallo de red no aparece como servicio operativo", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network error"));
  await renderRoute("/estado");
  expect(
    await screen.findByText("No pudimos confirmar la conexión"),
  ).toBeInTheDocument();
});

it("las guías enlazan con las rutas reales", async () => {
  await renderRoute("/ayuda/crear-un-caso");
  expect(
    screen.getByRole("link", { name: /Abrir en Aletheia/ }),
  ).toHaveAttribute("href", "/app/casos");
  expect(fetchMock).not.toHaveBeenCalled();
});
