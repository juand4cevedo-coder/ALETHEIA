import { readFileSync } from "node:fs";
import { join } from "node:path";

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();
const ADMIN_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const OTHER_ID = "01890a5d-ac96-774b-bcce-b302099a8060";

function serve(platformAdmin: boolean) {
  let status = "active";
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me")
      return jsonResponse({
        id: ADMIN_ID,
        full_name: "Ana Restrepo",
        email: "ana@example.com",
        email_verified: true,
        platform_admin: platformAdmin,
        permissions: platformAdmin ? ["platform.manage"] : [],
        organization: null,
        legal: {
          accepted_version: LEGAL_VERSION,
          current_version: LEGAL_VERSION,
          acceptance_required: false,
        },
      });
    if (path === "/api/v1/platform/users" && request.method === "GET")
      return jsonResponse({
        items: [
          {
            id: OTHER_ID,
            full_name: "Carlos Gómez",
            email: "carlos@example.com",
            status,
            email_verified: true,
            platform_admin: false,
            created_at: "2026-11-01T15:00:00Z",
          },
        ],
        next_cursor: null,
        total: 1,
      });
    if (
      path === `/api/v1/platform/users/${OTHER_ID}/status` &&
      request.method === "PATCH"
    ) {
      status = ((await request.json()) as { status: string }).status;
      return jsonResponse({ id: OTHER_ID, status });
    }
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("impide cargar cuentas a quien no administra la plataforma", async () => {
  serve(false);
  await renderRoute("/app/plataforma");
  expect(
    await screen.findByText("Esta cuenta no administra la plataforma."),
  ).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.some(([input]) =>
      (input as Request).url.includes("/api/v1/platform/users"),
    ),
  ).toBe(false);
});

it("confirma el bloqueo y actualiza el estado de la cuenta", async () => {
  serve(true);
  const user = userEvent.setup();
  await renderRoute("/app/plataforma");
  expect(await screen.findByText("carlos@example.com")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Bloquear" }));
  const dialog = screen.getByRole("dialog", { name: "Bloquear cuenta" });
  expect(dialog).toHaveTextContent("carlos@example.com");
  await user.click(screen.getByRole("button", { name: "Bloquear cuenta" }));
  await waitFor(() =>
    expect(screen.getByText("Bloqueada")).toBeInTheDocument(),
  );
  expect(
    fetchMock.mock.calls.some(
      ([input]) =>
        (input as Request).method === "PATCH" &&
        (input as Request).url.includes(`/platform/users/${OTHER_ID}/status`),
    ),
  ).toBe(true);
});

it("envía la búsqueda y los filtros de cuentas al backend", async () => {
  serve(true);
  const user = userEvent.setup();
  await renderRoute("/app/plataforma");
  await screen.findByText("carlos@example.com");

  await user.type(screen.getByLabelText("Nombre o correo"), "Carlos Gómez");
  await user.selectOptions(screen.getByLabelText("Estado"), "blocked");
  await user.selectOptions(screen.getByLabelText("Verificación"), "pending");
  await user.selectOptions(screen.getByLabelText("Ámbito"), "workspace");
  await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const request = input as Request;
        const url = new URL(request.url);
        return (
          request.method === "GET" &&
          url.pathname === "/api/v1/platform/users" &&
          url.searchParams.get("search") === "Carlos Gómez" &&
          url.searchParams.get("status") === "blocked" &&
          url.searchParams.get("email_verified") === "false" &&
          url.searchParams.get("platform_admin") === "false"
        );
      }),
    ).toBe(true),
  );
});

// jsdom no aplica CSS Modules: lo que sostiene el celular se lee del disco.
const css = readFileSync(
  join(import.meta.dirname, "PlatformPage.module.css"),
  "utf8",
);

// Quita cada bloque @container o @media con sus llaves anidadas y deja las reglas base, donde sea
// que estén en el archivo: una regla base añadida después de una consulta también se revisa.
function sinConsultas(texto: string): string {
  let salida = "";
  let i = 0;
  while (i < texto.length) {
    if (texto[i] === "@") {
      const abre = texto.indexOf("{", i);
      let nivel = 1;
      let j = abre + 1;
      while (nivel > 0 && j < texto.length) {
        if (texto[j] === "{") nivel++;
        if (texto[j] === "}") nivel--;
        j++;
      }
      i = j;
    } else {
      salida += texto[i];
      i++;
    }
  }
  return salida;
}
const base = sinConsultas(css);

function regla(selector: string): string {
  const escapado = selector.replace(/[.()>[\]="]/g, String.raw`\$&`);
  return (
    new RegExp(String.raw`(?:^|\n)\s*${escapado}\s*\{([^}]*)\}`).exec(
      css,
    )?.[1] ?? ""
  );
}

const paginas = ["PlatformPage.tsx", "PlatformModulesPage.tsx"].map((archivo) =>
  readFileSync(join(import.meta.dirname, archivo), "utf8"),
);

it("el apartado de reglas base no se queda vacío por un corte mal hecho", () => {
  expect(base).toMatch(/\.ticket\s*\{/);
  expect(base).not.toMatch(/@container/);
});

it("no declara anchos fijos mayores al ancho base fuera de una consulta de medio", () => {
  const anchos = [...base.matchAll(/(?<![-\w])width:\s*(\d+)px/g)].map((m) =>
    Number(m[1]),
  );
  expect(anchos.filter((valor) => valor > 360)).toEqual([]);
  expect(base).not.toMatch(/min-width:\s*\d+px/);
});

it("ya no fija el tema oscuro ni usa un literal para el filete", () => {
  expect(css).not.toMatch(/color-scheme/);
  expect(css).not.toMatch(/rgb\(7 20 35/);
  expect(css).toMatch(/var\(--ink-hairline\)/);
});

it("mide el corte contra el contenedor y no contra la ventana", () => {
  expect(css).toMatch(/\.screen\s*\{[^}]*container-type:\s*inline-size/);
  expect(css).toMatch(/@container \(max-width: \d+px\)/);
  expect(css).not.toMatch(/@media \(max-width/);
});

it("cuando la tabla aparece, la persona conserva 150 px de texto", () => {
  // Medido en el navegador con la tabla de cuentas, la más ancha: el correo habitual (260 px),
  // el ámbito (100), el estado (95), la verificación (95) y la acción (120), con relleno.
  const CORREO = 260 + 24;
  const AMBITO = 100 + 24;
  const ESTADO = 95 + 24;
  const VERIFICADO = 95 + 24;
  const ACCION = 120 + 24;
  const PANEL_PADDING = 2 * 24;
  const corte = Number(/@container \(max-width: (\d+)px\)/.exec(css)?.[1]);
  const tabla = corte + 1 - PANEL_PADDING;
  expect(
    tabla - CORREO - AMBITO - ESTADO - VERIFICADO - ACCION - 24,
  ).toBeGreaterThanOrEqual(150);
});

// En contraste forzado de Windows las sombras se descartan: sin un borde la superficie pierde su
// límite. El borde transparente no se ve y el sistema lo pinta (especificación, sección 7.3).
// No es sobrante: no lo borre.
it.each([
  [".ticket", css],
  [".targetCard", css],
])("%s lleva borde transparente de un píxel", (selector) => {
  expect(regla(selector)).toMatch(/border:\s*1px solid transparent/);
});

it("la fila convertida en tarjeta lleva borde transparente de un píxel", () => {
  const consulta = css.slice(css.indexOf("@container"));
  const fila = /\.table tbody tr \{([^}]*)\}/.exec(consulta)?.[1] ?? "";
  expect(fila).toMatch(/border:\s*1px solid transparent/);
});

it("los dígitos del radicado llevan borde transparente de un píxel", () => {
  const filing = readFileSync(
    join(import.meta.dirname, "../components/ui/FilingNumber.module.css"),
    "utf8",
  );
  expect(/\.digits\s*\{([^}]*)\}/.exec(filing)?.[1]).toMatch(
    /border:\s*1px solid transparent/,
  );
});

it("la tarjeta no desborda con un correo sin puntos de corte", () => {
  // Un elemento de rejilla tiene ancho mínimo automático y overflow-wrap: break-word no lo reduce:
  // una dirección larga sin guiones empujaba la tarjeta fuera de la pantalla.
  const consulta = css.slice(css.indexOf("@container"));
  const fila = /\.table tbody tr \{([^}]*)\}/.exec(consulta)?.[1] ?? "";
  expect(fila).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  expect(consulta).toMatch(/min-width:\s*0/);
  expect(consulta).toMatch(/overflow-wrap:\s*anywhere/);
  expect(regla(".targetCard")).toMatch(
    /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  expect(regla(".targetCard span")).toMatch(/overflow-wrap:\s*anywhere/);
  expect(regla(".note")).toMatch(/overflow-wrap:\s*anywhere/);
});

it("devuelve a cada tabla sus roles de tabla aunque el CSS cambie su display", () => {
  for (const fuente of paginas) {
    const tablas = fuente.match(/<table\b/g)?.length ?? 0;
    expect(fuente.match(/<table [^>]*role="table"/g)?.length ?? 0).toBe(tablas);
    expect(fuente.match(/<thead role="rowgroup"/g)?.length ?? 0).toBe(tablas);
    expect(fuente.match(/<tbody role="rowgroup"/g)?.length ?? 0).toBe(tablas);
    expect(fuente.match(/<tr\b(?![^>]*role="row")/g)).toBeNull();
    expect(fuente.match(/<td\b(?![^>]*role="cell")/g)).toBeNull();
    expect(
      fuente.match(/<th scope="col"(?![^>]*role="columnheader")/g),
    ).toBeNull();
    expect(
      fuente.match(/<th scope="row"(?![^>]*role="rowheader")/g),
    ).toBeNull();
  }
});

it("cada rótulo de tarjeta repite el texto de su encabezado de columna", () => {
  // Cada tabla: encabezados de columna en orden y rótulos data-label de la primera fila. La
  // celda del encabezado de fila no lleva rótulo y la columna de acción tampoco.
  let revisadas = 0;
  for (const fuente of paginas) {
    for (const tabla of fuente.split("<table").slice(1)) {
      const cabecera = [
        ...(tabla.split("</thead>")[0] ?? "").matchAll(
          /<th scope="col" role="columnheader">\s*([^<]+?)\s*<\/th>/g,
        ),
      ].map((m) => m[1]!);
      const rotulos = [
        ...(tabla.split("</thead>")[1] ?? "")
          .split("</tr>")[0]!
          .matchAll(/data-label="([^"]+)"/g),
      ].map((m) => m[1]!);
      expect(rotulos.length).toBeGreaterThan(0);
      for (const rotulo of rotulos) expect(cabecera).toContain(rotulo);
      // Solo el encabezado de fila y, en cuentas, la acción quedan sin rótulo.
      expect(cabecera.length - rotulos.length).toBeLessThanOrEqual(2);
      revisadas++;
    }
  }
  expect(revisadas).toBe(3);
});

it("rotula cada celda de la tabla para la tarjeta del celular", async () => {
  serve(true);
  await renderRoute("/app/plataforma");
  await screen.findByText("carlos@example.com");
  const celdas = [...document.querySelectorAll("tbody td")];
  expect(celdas.map((celda) => celda.getAttribute("data-label"))).toEqual([
    "Correo",
    "Ámbito",
    "Estado",
    "Correo verificado",
    null,
  ]);
});
