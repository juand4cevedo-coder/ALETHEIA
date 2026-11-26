import type { RouteObject } from "react-router";

import { SITE_URL } from "../config/site.ts";
import type { MetaPagina } from "./paginas.ts";

// Piezas de texto del prerender: la cabecera de cada página, el mapa del sitio y la lista de
// rutas de la aplicación para Caddy. Son funciones puras para poder probarlas sin construir.

/** Marcas de frontend/index.html donde el prerender pone la cabecera y el contenido. */
export const MARCA_CABECERA = "<!--cabecera-de-la-pagina-->";
export const MARCA_CONTENIDO = "<!--contenido-de-la-pagina-->";

/** Atributo de lo que main.tsx retira al arrancar, porque React lo vuelve a poner. */
const ATRIBUTO_ESTATICO = "data-estatica";

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** JSON dentro de <script>: «<» se escribe como < para que ningún texto cierre la etiqueta. */
export function jsonEnScript(datos: unknown): string {
  return JSON.stringify(datos).replaceAll("<", "\\u003c");
}

function meta(atributo: "name" | "property", clave: string, valor: string) {
  return `<meta ${atributo}="${clave}" content="${escaparHtml(valor)}" />`;
}

/** Cabecera propia de una página: lo que React pone al dibujarla, más lo que solo leen las
 * redes y los buscadores (Open Graph, X y datos estructurados). */
export function cabecera(
  pagina: MetaPagina,
  extra: { estructurados?: unknown; precargas?: string[] } = {},
): string {
  const estatica = ATRIBUTO_ESTATICO;
  const descripcion = pagina.descripcion;
  const lineas = [`<title ${estatica}>${escaparHtml(pagina.titulo)}</title>`];
  if (descripcion) {
    lineas.push(
      `<meta name="description" content="${escaparHtml(descripcion)}" ${estatica} />`,
    );
  }
  if (pagina.canonica) {
    lineas.push(
      `<link rel="canonical" href="${escaparHtml(pagina.canonica)}" ${estatica} />`,
    );
  }
  if (!pagina.indexable) {
    lineas.push(`<meta name="robots" content="noindex" ${estatica} />`);
  }
  lineas.push(...(extra.precargas ?? []));
  lineas.push(
    meta("property", "og:type", pagina.tipo),
    meta("property", "og:url", pagina.canonica || SITE_URL + pagina.ruta),
    meta("property", "og:title", pagina.titulo),
    meta("name", "twitter:title", pagina.titulo),
    meta("property", "og:image", SITE_URL + pagina.imagen),
    meta("property", "og:image:width", "1200"),
    meta("property", "og:image:height", "630"),
    meta(
      "property",
      "og:image:alt",
      `${pagina.titulo}. Imagen con el nombre de ALETHEIA.`,
    ),
    meta("name", "twitter:image", SITE_URL + pagina.imagen),
  );
  if (descripcion) {
    lineas.push(
      meta("property", "og:description", descripcion),
      meta("name", "twitter:description", descripcion),
    );
  }
  if (pagina.tipo === "article" && pagina.publicado) {
    lineas.push(meta("property", "article:published_time", pagina.publicado));
    if (pagina.seccion) {
      lineas.push(meta("property", "article:section", pagina.seccion));
    }
  }
  if (extra.estructurados) {
    lineas.push(
      `<script type="application/ld+json">${jsonEnScript(extra.estructurados)}</script>`,
    );
  }
  return lineas.join("\n    ");
}

/** Pone la cabecera y el contenido en la plantilla. Falla si la plantilla perdió sus marcas. */
export function llenarPlantilla(
  plantilla: string,
  cabeceraHtml: string,
  contenido: string,
): string {
  for (const marca of [MARCA_CABECERA, MARCA_CONTENIDO]) {
    if (plantilla.split(marca).length !== 2) {
      throw new Error(`La plantilla debe tener una vez la marca ${marca}`);
    }
  }
  return plantilla
    .replace(MARCA_CABECERA, () => cabeceraHtml)
    .replace(MARCA_CONTENIDO, () => contenido);
}

const HOISTABLE = /^(?:<link\b[^>]*>|<meta\b[^>]*>|<title>[\s\S]*?<\/title>)+/;

/** Separa lo que React 19 sube al <head> (va al principio del HTML) del contenido. */
export function separarCabecera(html: string): {
  titulo: string | undefined;
  descripcion: string | undefined;
  contenido: string;
} {
  const inicio = HOISTABLE.exec(html)?.[0] ?? "";
  // La CSP no admite estilos en línea: un atributo style en el HTML estático se bloquearía y
  // dejaría un error en la consola. Son variables de animación; React las pone al montar.
  const contenido = html.slice(inicio.length).replace(/ style="[^"]*"/g, "");
  if (/<script\b/i.test(contenido)) {
    throw new Error("El contenido prerenderizado trae un script en línea");
  }
  const titulo = /<title>([\s\S]*?)<\/title>/.exec(inicio)?.[1];
  const descripcion = /<meta name="description" content="([^"]*)"/.exec(
    inicio,
  )?.[1];
  return { titulo, descripcion, contenido };
}

/** Mapa del sitio con las páginas que van en él. lastmod es la fecha del artículo o la de
 * la construcción. */
export function mapaDelSitio(
  paginas: readonly MetaPagina[],
  fecha: string,
): string {
  const urls = paginas
    .filter((pagina) => pagina.enMapa && pagina.indexable)
    .map(
      (pagina) =>
        `  <url>\n    <loc>${escaparHtml(pagina.canonica)}</loc>\n    <lastmod>${pagina.actualizado ?? pagina.publicado ?? fecha}</lastmod>\n  </url>`,
    );
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n"
  );
}

/** Rutas del enrutador con su dirección completa. `hijos` dice si la ruta tiene rutas dentro. */
export function rutasDelEnrutador(
  rutas: readonly RouteObject[],
  base = "",
): { patron: string; hijos: boolean }[] {
  const salida: { patron: string; hijos: boolean }[] = [];
  for (const ruta of rutas) {
    const propia = ruta.path
      ? (base.endsWith("/") ? base : base + "/") + ruta.path
      : base;
    if (ruta.path || ruta.index) {
      salida.push({ patron: propia || "/", hijos: Boolean(ruta.children) });
    }
    if (ruta.children) salida.push(...rutasDelEnrutador(ruta.children, propia));
  }
  return salida;
}

/** Patrones públicos con parámetro cuyas direcciones salen todas en el prerender. */
export const PATRONES_PRERENDERIZADOS = [
  "/docs/:slug?",
  "/blog/:slug",
  "/ayuda/:slug",
  "/legal/:pagina",
] as const;

/** Direcciones que Caddy debe responder con la aplicación (index de una sola página): las que
 * no tienen HTML propio. Falla si una ruta del enrutador no queda cubierta por ninguno de
 * los dos caminos, porque esa dirección respondería 404. */
export function rutasDeLaAplicacion(
  rutas: readonly RouteObject[],
  prerenderizadas: ReadonlySet<string>,
): string[] {
  const caminos = new Set<string>();
  for (const { patron, hijos } of rutasDelEnrutador(rutas)) {
    if (patron === "/*") continue;
    if (prerenderizadas.has(patron)) continue;
    if ((PATRONES_PRERENDERIZADOS as readonly string[]).includes(patron)) {
      continue;
    }
    const corte = patron.search(/[:*]/);
    if (corte === -1) {
      caminos.add(patron);
      caminos.add(patron + "/");
      if (hijos) caminos.add(patron + "/*");
    } else {
      caminos.add(patron.slice(0, corte).replace(/\/?$/, "/") + "*");
    }
  }
  // Lo que ya cubre un prefijo con * sobra.
  const prefijos = [...caminos]
    .filter((camino) => camino.endsWith("/*"))
    .map((camino) => camino.slice(0, -1));
  return [...caminos]
    .filter(
      (camino) =>
        !prefijos.some(
          (prefijo) => camino !== prefijo + "*" && camino.startsWith(prefijo),
        ),
    )
    .sort();
}

/** Fragmento de Caddyfile con esas direcciones, que importa infra/Caddyfile. */
export function matcherDeCaddy(caminos: readonly string[]): string {
  return (
    "# Generado al construir la interfaz (scripts/prerender.mjs) desde frontend/src/routes.\n" +
    "# Direcciones de la aplicación que no tienen HTML propio: reciben aplicacion.html.\n" +
    `@aplicacion path ${caminos.join(" ")}\n`
  );
}
