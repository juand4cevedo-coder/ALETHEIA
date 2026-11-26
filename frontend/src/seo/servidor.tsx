import { StrictMode, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { prerender } from "react-dom/static";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";

import { LEGAL_PAGES } from "../config/routes.ts";
import { DOCUMENTATION } from "../content/documentation.ts";
import { HELP, JOURNAL } from "../content/journal.ts";
import {
  CONSENT_VERSION,
  COOKIE_CHOICE_KEY,
} from "../features/consent/cookieConsent.ts";
import { LEGAL_DOCUMENTS } from "../features/legal/documents.ts";
import { FaqSection } from "../features/landing/FaqSection.tsx";
import { routes } from "../routes/router.tsx";
import { PLANES_PUBLICADOS } from "./catalogo.ts";
import { datosEstructurados, type Pregunta } from "./estructurados.ts";
import {
  cabecera,
  escaparHtml,
  llenarPlantilla,
  mapaDelSitio,
  matcherDeCaddy,
  rutasDeLaAplicacion,
  separarCabecera,
} from "./html.ts";
import { metaArticulo, metaAyuda, metaGuia, metaLegal } from "./contenidos.ts";
import type { MetaPagina } from "./paginas.ts";
import { PAGINAS } from "./fichas.ts";

// Entrada del prerender (scripts/prerender.mjs). Se construye con Vite para Node, con el mismo
// código de las páginas, y corre dentro de un navegador simulado sin estado guardado.

type Pagina = { meta: MetaPagina; nombre: string };

/** Todas las páginas que reciben HTML propio, con el nombre que llevan en la navegación. */
export function paginasPublicas(): Pagina[] {
  const fijas = Object.values(PAGINAS).filter(
    (meta) => meta !== PAGINAS.noEncontrada,
  );
  const guias = DOCUMENTATION.map((guia) => guia.slug);
  const primera = DOCUMENTATION.find((guia) => guia.slug === "introduccion");
  return [
    ...fijas.map((meta) => ({
      meta,
      nombre:
        meta === PAGINAS.blog ? "Blog" : meta.titulo.replace(/ \| [^|]+$/, ""),
    })),
    ...(primera
      ? [{ meta: metaGuia(primera, "/docs"), nombre: primera.title }]
      : []),
    ...DOCUMENTATION.map((guia) => ({
      meta: metaGuia(guia),
      nombre: guia.title,
    })),
    ...JOURNAL.map((articulo) => ({
      meta: metaArticulo(articulo),
      nombre: articulo.title,
    })),
    ...HELP.map((ayuda) => ({
      meta: metaAyuda(ayuda, guias),
      nombre: ayuda.title,
    })),
    ...LEGAL_PAGES.map(({ slug }) => {
      const documento = LEGAL_DOCUMENTS[slug];
      return { meta: metaLegal(documento), nombre: documento.title };
    }),
  ];
}

/** Las preguntas de una página, leídas de sus listas de preguntas (FaqList) tal como se
 * dibujan. Por defecto, las de «Antes de empezar» de la portada. */
export function preguntasDe(html = renderToString(<FaqSection />)): Pregunta[] {
  const plantilla = document.createElement("template");
  plantilla.innerHTML = html;
  const detalles = plantilla.content.querySelectorAll(
    "[data-preguntas] details",
  );
  return [...detalles].map((detalle) => {
    const resumen = detalle.querySelector("summary");
    const pregunta = resumen?.textContent?.trim() ?? "";
    resumen?.remove();
    return { pregunta, respuesta: detalle.textContent?.trim() ?? "" };
  });
}

/** Las preguntas de la página, con la garantía de que ninguna quedó vacía. La portada siempre
 * las tiene: si no se leen, algo cambió en la sección y el sitio no se construye. */
function preguntasLeidas(ruta: string, contenido: string): Pregunta[] {
  const preguntas = preguntasDe(contenido);
  if (preguntas.some((p) => !p.pregunta || !p.respuesta)) {
    throw new Error(`${ruta}: hay una pregunta sin texto o sin respuesta`);
  }
  if (ruta === "/" && !preguntas.length) {
    throw new Error("No se pudieron leer las preguntas de la portada");
  }
  return preguntas;
}

const handler = createStaticHandler(routes);

async function dibujar(ruta: string): Promise<string> {
  const contexto = await handler.query(new Request("http://prerender" + ruta));
  if (contexto instanceof Response) {
    throw new Error(`${ruta} redirige: no se puede prerenderizar`);
  }
  const router = createStaticRouter(handler.dataRoutes, contexto);
  const app: ReactNode = (
    <StrictMode>
      <StaticRouterProvider
        router={router}
        context={contexto}
        hydrate={false}
      />
    </StrictMode>
  );
  // La primera pasada espera a que lleguen las partes diferidas (React.lazy); la segunda ya
  // las tiene y sale completa, sin los scripts en línea con que React completaría el resto.
  await prerender(app);
  return renderToString(app);
}

export type Sitio = {
  /** Archivos por ruta relativa a dist («precios/index.html»). */
  archivos: Map<string, string>;
  mapa: string;
  caddy: string;
};

/** Arma el sitio sobre el index.html que generó Vite. `fecha` es AAAA-MM-DD. */
export async function generarSitio(
  plantilla: string,
  fecha: string,
): Promise<Sitio> {
  // Sin la elección de cookies guardada, el aviso saldría en el HTML de todas las páginas.
  localStorage.setItem(
    COOKIE_CHOICE_KEY,
    JSON.stringify({
      version: CONSENT_VERSION,
      decidedAt: fecha,
      analytics: false,
    }),
  );

  const paginas = paginasPublicas();
  const archivos = new Map<string, string>();

  for (const { meta, nombre } of paginas) {
    const dibujo = separarCabecera(await dibujar(meta.ruta));
    // Una sola fuente: lo que React pone al navegar debe ser lo mismo que lleva el HTML.
    if (dibujo.titulo !== escaparHtml(meta.titulo)) {
      throw new Error(
        `${meta.ruta}: la página dibuja el título «${dibujo.titulo}» y su ficha dice «${meta.titulo}»`,
      );
    }
    if (dibujo.descripcion !== escaparHtml(meta.descripcion)) {
      throw new Error(`${meta.ruta}: la descripción no es la de su ficha`);
    }
    const html = llenarPlantilla(
      plantilla,
      cabecera(meta, {
        estructurados: datosEstructurados(meta, {
          nombre,
          planes: PLANES_PUBLICADOS,
          preguntas: preguntasLeidas(meta.ruta, dibujo.contenido),
        }),
      }),
      dibujo.contenido,
    );
    const archivo =
      meta.ruta === "/" ? "index.html" : meta.ruta.slice(1) + "/index.html";
    archivos.set(archivo, html);
  }

  const noEncontrada = separarCabecera(await dibujar("/404-prerender"));
  archivos.set(
    "404.html",
    llenarPlantilla(
      plantilla,
      cabecera(PAGINAS.noEncontrada),
      noEncontrada.contenido,
    ),
  );
  // La aplicación con sesión se dibuja en el navegador: su HTML no trae contenido.
  archivos.set(
    "aplicacion.html",
    llenarPlantilla(
      plantilla,
      `<title data-estatica>ALETHEIA</title>\n    <meta name="robots" content="noindex" data-estatica />`,
      "",
    ),
  );

  const metas = paginas.map((pagina) => pagina.meta);
  const prerenderizadas = new Set(metas.map((meta) => meta.ruta));
  return {
    archivos,
    mapa: mapaDelSitio(metas, fecha),
    caddy: matcherDeCaddy(rutasDeLaAplicacion(routes, prerenderizadas)),
  };
}
