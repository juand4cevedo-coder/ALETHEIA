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
  ).toHaveLength(5);
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar artículos" }),
    "huella",
  );
  expect(
    screen.getByRole("heading", {
      name: "Qué dice una huella digital y qué no dice",
    }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Práctica" }));
  expect(screen.getByText("No encontramos ese tema")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Ver todos los artículos" }),
  );
  expect(
    within(screen.getByRole("main")).getAllByRole("heading", { level: 2 }),
  ).toHaveLength(5);
  expect(await seriousAxeViolations(container)).toEqual([]);
});

it("el artículo conserva el alcance de la comparación", async () => {
  await renderRoute("/blog/que-dice-una-huella-sha256");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Qué dice una huella digital y qué no dice",
  );
  expect(screen.getByText(/No identifica al autor/)).toBeInTheDocument();
  expect(screen.queryByText(/32 MB/)).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("cada artículo dice quién lo escribió y cuándo, y enlaza dentro del texto", async () => {
  await renderRoute("/blog/conservar-chat-correo-video-como-evidencia");
  const main = within(screen.getByRole("main"));
  expect(main.getByText("Juan Diego Acevedo Calderón")).toBeInTheDocument();
  expect(main.getByText("24 de noviembre de 2026")).toHaveAttribute(
    "datetime",
    "2026-11-24",
  );
  expect(
    main.getByRole("link", { name: "comprobador de archivos" }),
  ).toHaveAttribute("href", "/verificador");
  expect(main.getByRole("link", { name: "planes y precios" })).toHaveAttribute(
    "href",
    "/precios",
  );
  expect(main.queryByText(/\]\(\//)).not.toBeInTheDocument();
});

it("el artículo del estampado cronológico no promete valor probatorio", async () => {
  await renderRoute("/blog/aletheia-y-el-estampado-cronologico");
  expect(
    screen.getByText(/no es una entidad de certificación acreditada/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "verificador público" }),
  ).toHaveAttribute("href", "/verificador");
});

it("nosotros nombra a la persona responsable con datos comprobables", async () => {
  const { container } = await renderRoute("/nosotros");
  const main = within(screen.getByRole("main"));
  expect(main.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Quién está detrás de ALETHEIA",
  );
  expect(
    main.getByAltText("Juan Diego Acevedo Calderón, fundador de ALETHEIA"),
  ).toHaveAttribute("srcset", expect.stringContaining("fundador-480.webp"));
  const ficha = within(main.getByRole("figure"));
  expect(ficha.getByText("NIT 1214744661-9")).toBeInTheDocument();
  expect(
    ficha.getByRole("link", { name: "contacto@aletheia.sbs" }),
  ).toHaveAttribute("href", "mailto:contacto@aletheia.sbs");
  expect(await seriousAxeViolations(container)).toEqual([]);
});

it("seguridad cuenta los controles que existen", async () => {
  await renderRoute("/seguridad");
  const main = within(screen.getByRole("main"));
  for (const control of [
    "Archivos cifrados, con una llave por caso",
    "Cada despacho, separado en la base de datos",
    "Una custodia a la que solo se le agregan eventos",
    "Un paquete que se verifica sin ALETHEIA",
    "Doble factor y códigos de recuperación",
    "Auditoría para quien responde por el despacho",
    "Verificación de persona en los accesos",
  ]) {
    expect(main.getByRole("heading", { name: control })).toBeInTheDocument();
  }
  expect(main.queryByText(/32 MB|límite de tamaño evita/)).toBeNull();
});

it("soporte muestra los canales y los plazos de respuesta", async () => {
  const { container } = await renderRoute("/soporte");
  const main = within(screen.getByRole("main"));
  expect(
    main.getByRole("link", { name: "Ir a Pedir soporte" }),
  ).toHaveAttribute("href", "/app/soporte");
  expect(main.getByRole("link", { name: "+57 311 782 0789" })).toHaveAttribute(
    "href",
    "tel:+573117820789",
  );
  expect(
    main.getByText("Consulta sobre sus datos personales"),
  ).toBeInTheDocument();
  expect(main.getByText("10 días hábiles")).toBeInTheDocument();
  expect(await seriousAxeViolations(container)).toEqual([]);
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
    screen.getByRole("link", { name: /Abrir en ALETHEIA/ }),
  ).toHaveAttribute("href", "/app/casos");
  expect(fetchMock).not.toHaveBeenCalled();
});
