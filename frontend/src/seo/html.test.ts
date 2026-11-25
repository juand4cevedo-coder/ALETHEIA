import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { routes } from "../routes/router.tsx";
import {
  cabecera,
  escaparHtml,
  jsonEnScript,
  llenarPlantilla,
  MARCA_CABECERA,
  MARCA_CONTENIDO,
  PATRONES_PRERENDERIZADOS,
  mapaDelSitio,
  matcherDeCaddy,
  rutasDeLaAplicacion,
  rutasDelEnrutador,
  separarCabecera,
} from "./html.ts";
import { PAGINAS } from "./fichas.ts";
import type { MetaPagina } from "./paginas.ts";

const articulo: MetaPagina = {
  ruta: "/blog/prueba",
  titulo: 'Un "artículo" <de prueba> | ALETHEIA',
  descripcion: "Resumen & detalle.",
  canonica: "https://aletheia.sbs/blog/prueba",
  tipo: "article",
  indexable: true,
  enMapa: true,
  publicado: "2026-10-05",
  seccion: "Práctica",
};

describe("cabecera", () => {
  it("escribe título, descripción, canónica, Open Graph y X con los textos escapados", () => {
    const html = cabecera(articulo, { estructurados: { a: "</script>" } });
    expect(html).toContain(
      "<title data-estatica>Un &quot;artículo&quot; &lt;de prueba&gt; | ALETHEIA</title>",
    );
    expect(html).toContain(
      '<meta name="description" content="Resumen &amp; detalle." data-estatica />',
    );
    expect(html).toContain(
      '<link rel="canonical" href="https://aletheia.sbs/blog/prueba" data-estatica />',
    );
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain(
      '<meta property="og:url" content="https://aletheia.sbs/blog/prueba" />',
    );
    expect(html).toContain('<meta name="twitter:title"');
    expect(html).toContain('<meta name="twitter:description"');
    expect(html).toContain(
      '<meta property="article:published_time" content="2026-10-05" />',
    );
    expect(html).not.toContain('</script>"}');
    expect(html).toContain('{"a":"\\u003c/script>"}');
    expect(html).not.toContain("noindex");
  });

  it("una página que no se indexa lleva noindex y no declara canónica", () => {
    const html = cabecera(PAGINAS.noEncontrada);
    expect(html).toContain(
      '<meta name="robots" content="noindex" data-estatica />',
    );
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain('<meta property="og:type" content="website" />');
  });
});

describe("plantilla", () => {
  const plantilla = readFileSync(join(process.cwd(), "index.html"), "utf8");

  it("index.html tiene las dos marcas y ninguna descripción ni precarga fija", () => {
    expect(plantilla.split(MARCA_CABECERA)).toHaveLength(2);
    expect(plantilla.split(MARCA_CONTENIDO)).toHaveLength(2);
    expect(plantilla).not.toContain('name="description"');
    expect(plantilla).not.toContain("<title>");
    expect(plantilla).not.toContain("og:url");
    expect(plantilla).not.toContain("hero-real");
  });

  it("llena la plantilla y falla si le falta una marca", () => {
    const html = llenarPlantilla(
      plantilla,
      "<title>T</title>",
      "<p>$1 hola</p>",
    );
    expect(html).toContain("<title>T</title>");
    expect(html).toContain('<div id="root"><p>$1 hola</p></div>');
    expect(() => llenarPlantilla("<html></html>", "", "")).toThrow(/marca/);
  });
});

describe("separarCabecera", () => {
  it("separa lo que React sube al head del contenido", () => {
    const partes = separarCabecera(
      '<link rel="preload" as="image" href="/a.svg"/><title>Hola | ALETHEIA</title><meta name="description" content="Texto"/><link rel="canonical" href="x"/><main><meta itemprop="x"/></main>',
    );
    expect(partes.titulo).toBe("Hola | ALETHEIA");
    expect(partes.descripcion).toBe("Texto");
    expect(partes.contenido).toBe('<main><meta itemprop="x"/></main>');
  });

  it("quita los estilos en línea, que la CSP bloquearía", () => {
    expect(separarCabecera('<ul><li style="--i:0">a</li></ul>').contenido).toBe(
      "<ul><li>a</li></ul>",
    );
  });

  it("rechaza un contenido con scripts en línea", () => {
    expect(() =>
      separarCabecera("<div></div><script>alert(1)</script>"),
    ).toThrow(/script/);
  });
});

describe("mapaDelSitio", () => {
  it("lista solo lo indexable que va en el mapa, con su lastmod", () => {
    const mapa = mapaDelSitio(
      [
        PAGINAS.inicio,
        articulo,
        { ...PAGINAS.inicio, ruta: "/docs", enMapa: false },
        PAGINAS.noEncontrada,
      ],
      "2026-11-25",
    );
    expect(mapa).toContain(
      "<loc>https://aletheia.sbs/</loc>\n    <lastmod>2026-11-25</lastmod>",
    );
    expect(mapa).toContain(
      "<loc>https://aletheia.sbs/blog/prueba</loc>\n    <lastmod>2026-10-05</lastmod>",
    );
    expect(mapa.match(/<url>/g)).toHaveLength(2);
  });
});

// Imita el matcher path de Caddy: exacto, o prefijo cuando termina en *.
function cubre(caminos: readonly string[], direccion: string): boolean {
  return caminos.some((camino) =>
    camino.endsWith("*")
      ? direccion.startsWith(camino.slice(0, -1))
      : direccion === camino,
  );
}

describe("rutas de la aplicación para Caddy", () => {
  const publicas = new Set([
    "/",
    "/precios",
    "/registro",
    "/verificador",
    "/blog",
    "/ayuda",
    "/filosofia",
    "/nosotros",
    "/seguridad",
    "/soporte",
    "/empresa",
    "/legal",
    "/marca",
    "/estado",
  ]);
  const caminos = rutasDeLaAplicacion(routes, publicas);

  it("cubre cada pantalla del enrutador que no tiene HTML propio", () => {
    for (const { patron } of rutasDelEnrutador(routes)) {
      if (
        patron === "/*" ||
        publicas.has(patron) ||
        (PATRONES_PRERENDERIZADOS as readonly string[]).includes(patron)
      ) {
        continue;
      }
      const ejemplo = patron.replace(/:[^/]+\??/g, "x").replace(/\*$/, "x");
      expect(cubre(caminos, ejemplo), ejemplo).toBe(true);
    }
  });

  it("incluye el ingreso, el espacio de trabajo y los enlaces de correo", () => {
    for (const direccion of [
      "/ingresar",
      "/app",
      "/app/casos/123/evidencias/456",
      "/app/plataforma/despachos",
      "/registro/correo",
      "/invitacion",
      "/portal",
      "/verificar-correo",
      "/restablecer-contrasena",
    ]) {
      expect(cubre(caminos, direccion), direccion).toBe(true);
    }
  });

  it("deja fuera las páginas públicas y lo que no existe", () => {
    for (const direccion of [
      "/",
      "/precios",
      "/registro",
      "/blog/x",
      "/nada",
      "/apple",
    ]) {
      expect(cubre(caminos, direccion), direccion).toBe(false);
    }
  });

  it("escribe el matcher con nombre que importa el Caddyfile", () => {
    expect(matcherDeCaddy(["/app", "/app/*"])).toMatch(
      /^@aplicacion path \/app \/app\/\*$/m,
    );
  });
});

describe("escapes", () => {
  it("escapa HTML y JSON para script", () => {
    expect(escaparHtml(`<a href="x">&</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;",
    );
    expect(jsonEnScript({ t: "<b>" })).toBe('{"t":"\\u003cb>"}');
  });
});
