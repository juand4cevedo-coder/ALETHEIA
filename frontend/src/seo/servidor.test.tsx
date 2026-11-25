import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Lo mismo que hace scripts/prerender/react-servidor.mjs en el build: los ganchos sin lectura
// del servidor usan la del navegador simulado.
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useSyncExternalStore: <T,>(
      subscribe: (aviso: () => void) => () => void,
      getSnapshot: () => T,
      getServerSnapshot?: () => T,
    ) =>
      react.useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot ?? getSnapshot,
      ),
  };
});

import { JOURNAL } from "../content/journal.ts";
import { FaqSection } from "../features/landing/FaqSection.tsx";
import { MARCA_CABECERA, MARCA_CONTENIDO } from "./html.ts";
import {
  generarSitio,
  paginasPublicas,
  preguntasDe,
} from "./servidor.tsx";

const PLANTILLA = `<!doctype html><html><head>${MARCA_CABECERA}</head><body><div id="root">${MARCA_CONTENIDO}</div></body></html>`;

describe("preguntas de la portada", () => {
  it("salen de la sección «Antes de empezar» tal como se dibuja", () => {
    const preguntas = preguntasDe();
    const { container } = render(<FaqSection />);
    const dibujadas = container.querySelectorAll("details");
    expect(preguntas).toHaveLength(dibujadas.length);
    expect(preguntas.length).toBeGreaterThan(0);
    expect(preguntas[0]!.pregunta).toBe(
      dibujadas[0]!.querySelector("summary")!.textContent!.trim(),
    );
    for (const item of preguntas) {
      expect(item.pregunta).toMatch(/^¿.+\?$/);
      expect(item.respuesta.length).toBeGreaterThan(10);
    }
  });
});

describe("páginas públicas", () => {
  it("incluye cada artículo del blog sin listarlo a mano", () => {
    const rutas = paginasPublicas().map((pagina) => pagina.meta.ruta);
    for (const articulo of JOURNAL) {
      expect(rutas).toContain(`/blog/${articulo.slug}`);
    }
    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it("tienen un título que cabe en el buscador y una descripción de frases completas", () => {
    for (const { meta } of paginasPublicas()) {
      expect(meta.titulo.length, meta.ruta).toBeLessThanOrEqual(60);
      expect(meta.titulo, meta.ruta).toMatch(/ALETHEIA$/);
      expect(meta.descripcion.length, meta.ruta).toBeLessThanOrEqual(155);
      expect(meta.descripcion.length, meta.ruta).toBeGreaterThanOrEqual(70);
      expect(meta.descripcion, meta.ruta).toMatch(/[.?!]$/);
    }
  });

  it("no repiten un paso en la ruta de navegación", () => {
    for (const { meta } of paginasPublicas()) {
      const rutas = (meta.migas ?? []).map((miga) => miga.ruta);
      expect(rutas, meta.ruta).not.toContain(meta.canonica.replace(/^https:\/\/[^/]+/, ""));
      expect(new Set(rutas).size, meta.ruta).toBe(rutas.length);
    }
  });
});

describe("generarSitio", () => {
  it(
    "dibuja cada página con su propia cabecera, el mapa y la lista de Caddy",
    { timeout: 60_000 },
    async () => {
      const sitio = await generarSitio(PLANTILLA, "2026-11-25");
      const precios = sitio.archivos.get("precios/index.html")!;
      expect(precios.match(/name="description"/g)).toHaveLength(1);
      expect(precios).toContain(
        '<meta property="og:url" content="https://aletheia.sbs/precios" />',
      );
      expect(precios).toContain('"@type":"SoftwareApplication"');
      expect(precios).toContain(
        '<meta property="og:image" content="https://aletheia.sbs/og/precios.png" />',
      );
      expect(precios).toContain(
        '<meta name="twitter:image" content="https://aletheia.sbs/og/precios.png" />',
      );
      expect(precios).toMatch(/<div id="root"><.+<\/div><\/body>/s);
      // Las tarjetas salen de la copia del catálogo: los buscadores leen los precios sin
      // ejecutar JavaScript, y la respuesta sobre usuarios adicionales dice los reales.
      expect(precios).toContain("29.900");
      expect(precios).toContain("59.900");
      expect(precios).not.toContain("Cargando los planes");
      expect(precios).toContain('"@type":"FAQPage"');
      expect(precios).toContain(
        "Profesional incluye 4 y cada persona adicional vale $19.900 al mes",
      );

      const comprobador = sitio.archivos.get("verificador/index.html")!;
      expect(comprobador).toContain('"@type":"WebApplication"');
      expect(comprobador).toContain('"@type":"FAQPage"');
      expect(comprobador).toContain("Get-FileHash archivo.pdf");

      const portada = sitio.archivos.get("index.html")!;
      expect(portada).toContain('"@type":"FAQPage"');
      expect(portada).toContain('rel="preload" as="image"');
      expect(precios).not.toContain('rel="preload" as="image"');

      const articulo = JOURNAL[0]!;
      const html = sitio.archivos.get(`blog/${articulo.slug}/index.html`)!;
      expect(html).toContain('<meta property="og:type" content="article" />');
      expect(html).toContain('"@type":"Article"');

      expect(sitio.archivos.get("404.html")).toContain("noindex");
      expect(sitio.archivos.get("aplicacion.html")).toContain(
        '<div id="root"></div>',
      );
      expect(sitio.mapa).toContain("https://aletheia.sbs/verificador");
      expect(sitio.mapa).toContain("https://aletheia.sbs/legal</loc>");
      expect(sitio.mapa).not.toContain("https://aletheia.sbs/docs</loc>");
      expect(sitio.caddy).toMatch(/^@aplicacion path .*\/ingresar /m);
      // La CSP prohíbe scripts en línea: solo valen los que cargan un archivo (src) y los datos
      // estructurados, que el navegador no ejecuta.
      const enLinea =
        /<script\b(?![^>]*\bsrc\s*=)(?![^>]*application\/ld\+json)[^>]*>/i;
      for (const contenido of sitio.archivos.values()) {
        expect(contenido).not.toMatch(enLinea);
      }
    },
  );
});
