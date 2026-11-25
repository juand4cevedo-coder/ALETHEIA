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
  category: string;
}): MetaPagina {
  return {
    ...pagina("/blog/" + articulo.slug, {
      titulo: tituloConMarca(articulo.title, `Blog de ${SITE_NAME}`),
      descripcion: resumir(articulo.summary),
      migas: [MIGA_INICIO, MIGA_BLOG],
    }),
    tipo: "article",
    publicado: articulo.date,
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
    migas: [MIGA_INICIO, MIGA_DOCUMENTACION],
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
  return pagina("/legal/" + documento.slug, {
    titulo: tituloConMarca(documento.title),
    descripcion: resumir(documento.description),
  });
}

const LARGO_MAXIMO_DESCRIPCION = 155;

/** Recorta un texto largo en la última palabra completa que cabe en una descripción. */
export function resumir(texto: string): string {
  if (texto.length <= LARGO_MAXIMO_DESCRIPCION) return texto;
  const corte = texto.slice(0, LARGO_MAXIMO_DESCRIPCION - 1);
  const frase = corte.lastIndexOf(". ");
  if (frase >= 100) return corte.slice(0, frase + 1);
  return corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:]$/, "") + ".";
}
