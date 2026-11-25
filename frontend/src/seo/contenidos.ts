import { LEGAL_EFFECTIVE_DATE } from "../config/legal.ts";
import { SITE_NAME, SITE_URL } from "../config/site.ts";
import {
  LARGO_MAXIMO_TITULO,
  MARCA,
  type MetaPagina,
  type Miga,
  pagina,
} from "./paginas.ts";

// Fichas de las páginas que salen de un contenido (artículos, guías, ayuda y políticas): cada
// página les pasa el suyo. Aparte de paginas.ts para no sumarlas a la descarga inicial.

export const MIGA_INICIO: Miga = { nombre: "Inicio", ruta: "/" };
export const MIGA_BLOG: Miga = { nombre: "Blog", ruta: "/blog" };
export const MIGA_DOCUMENTACION: Miga = {
  nombre: "Documentación",
  ruta: "/docs/introduccion",
};

/** El primer título que cabe en 60 caracteres: con su contexto, solo con la marca o sin nada. */
export function tituloConMarca(nombre: string, contexto?: string): string {
  const opciones = [
    contexto ? `${nombre} | ${contexto}` : undefined,
    nombre + MARCA,
    nombre,
  ];
  return (
    opciones.find(
      (opcion) => opcion !== undefined && opcion.length <= LARGO_MAXIMO_TITULO,
    ) ?? nombre
  );
}

/** Artículo del blog. */
export function metaArticulo(articulo: {
  slug: string;
  title: string;
  summary: string;
  date: string;
  updated?: string;
  category: string;
  /** Título para el buscador cuando el del artículo pasa de 60 caracteres. */
  seoTitle?: string;
  /** Descripción para el buscador cuando el resumen pasa de 155 caracteres. */
  seoDescription?: string;
}): MetaPagina {
  return {
    ...pagina("/blog/" + articulo.slug, {
      titulo: tituloConMarca(
        articulo.seoTitle ?? articulo.title,
        `Blog de ${SITE_NAME}`,
      ),
      descripcion: resumir(articulo.seoDescription ?? articulo.summary),
      migas: [MIGA_INICIO, MIGA_BLOG],
    }),
    tipo: "article",
    publicado: articulo.date,
    actualizado: articulo.updated ?? articulo.date,
    seccion: articulo.category,
  };
}

/** Guía de la documentación. /docs sin guía muestra la primera y declara su dirección. */
export function metaGuia(
  guia: { slug: string; title: string; description: string },
  ruta = "/docs/" + guia.slug,
): MetaPagina {
  const canonica = "/docs/" + guia.slug;
  return pagina(ruta, {
    titulo: tituloConMarca(guia.title, `Documentación de ${SITE_NAME}`),
    descripcion: resumir(guia.description),
    canonica: SITE_URL + canonica,
    enMapa: ruta === canonica,
    // La introducción es la portada de la documentación: su ruta no repite el paso.
    migas:
      canonica === MIGA_DOCUMENTACION.ruta
        ? [MIGA_INICIO]
        : [MIGA_INICIO, MIGA_DOCUMENTACION],
  });
}

/** Guía de la base de conocimiento. Si la documentación tiene la misma guía, esa es la
 * principal y esta no va en el mapa del sitio. */
export function metaAyuda(
  ayuda: { slug: string; title: string; text: string },
  guiasDocumentadas: readonly string[],
): MetaPagina {
  const duplicada = guiasDocumentadas.includes(ayuda.slug);
  return pagina("/ayuda/" + ayuda.slug, {
    titulo: tituloConMarca(ayuda.title, `Ayuda de ${SITE_NAME}`),
    descripcion: resumir(ayuda.text),
    canonica: SITE_URL + (duplicada ? "/docs/" : "/ayuda/") + ayuda.slug,
    enMapa: !duplicada,
  });
}

/** Política legal. */
export function metaLegal(documento: {
  slug: string;
  title: string;
  description: string;
}): MetaPagina {
  return {
    ...pagina("/legal/" + documento.slug, {
      titulo: tituloConMarca(documento.title),
      descripcion: resumir(documento.description),
    }),
    actualizado: LEGAL_EFFECTIVE_DATE,
  };
}

const LARGO_MAXIMO_DESCRIPCION = 155;

/** La descripción de un contenido. Si el texto pasa de 155 caracteres, se queda con las frases
 * completas que caben; nunca corta una frase por la mitad. Si ni la primera frase cabe, el
 * contenido necesita una descripción propia y la construcción del sitio se detiene. */
export function resumir(texto: string): string {
  if (texto.length <= LARGO_MAXIMO_DESCRIPCION) return texto;
  const frases = texto.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
  let resumen = "";
  for (const frase of frases) {
    const siguiente = (resumen + frase).trim();
    if (siguiente.length > LARGO_MAXIMO_DESCRIPCION) break;
    resumen = siguiente;
  }
  if (resumen.length < 70) {
    throw new Error(
      `La descripción no cabe en ${LARGO_MAXIMO_DESCRIPCION} caracteres sin cortar una frase: «${texto.slice(0, 60)}»`,
    );
  }
  return resumen;
}
