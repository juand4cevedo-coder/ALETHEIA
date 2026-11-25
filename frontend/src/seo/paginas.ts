import { SITE_NAME, SITE_URL } from "../config/site.ts";

// Título, descripción y dirección canónica de cada página pública: una sola fuente. Las páginas
// de React los ponen con <CabeceraSeo>, y el prerender (scripts/prerender.mjs) escribe con los
// mismos valores el HTML que leen los buscadores y las redes sin ejecutar JavaScript.
// Este módulo no importa contenidos: cada página le pasa el suyo, para no sumar textos a la
// descarga inicial.

export type Miga = { nombre: string; ruta: string };

export type MetaPagina = {
  /** Dirección que sirve la página, sin dominio («/precios»). */
  ruta: string;
  /** Palabra clave primero y la marca al final, en 60 caracteres o menos. */
  titulo: string;
  descripcion: string;
  /** Dirección absoluta que se declara como la principal. */
  canonica: string;
  tipo: "website" | "article";
  /** false agrega noindex: la página no debe aparecer en los buscadores. */
  indexable: boolean;
  /** Si va en el mapa del sitio. Una página cuya canónica es otra no va. */
  enMapa: boolean;
  /** Fecha de publicación de un artículo, AAAA-MM-DD. */
  publicado?: string;
  /** Último cambio real del contenido, AAAA-MM-DD: la fecha del mapa del sitio y de
   * dateModified. Sin ella, el mapa usa la fecha de la versión del sitio. */
  actualizado?: string;
  /** Categoría de un artículo. */
  seccion?: string;
  /** Ruta de navegación desde el inicio, sin la página misma. */
  migas?: Miga[];
  /** Imagen para compartir (1200 x 630), desde la raíz del sitio. Las que no tienen una propia
   * usan la general. Se generan con scripts/imagenes-sociales.mjs. */
  imagen: string;
};

export const LARGO_MAXIMO_TITULO = 60;
export const MARCA = ` | ${SITE_NAME}`;

type Fija = Pick<MetaPagina, "titulo" | "descripcion"> &
  Partial<
    Pick<MetaPagina, "canonica" | "indexable" | "enMapa" | "migas" | "imagen">
  >;

/** La imagen para compartir de las páginas que no tienen una propia. */
export const IMAGEN_GENERAL = "/og-image.png";

export function pagina(ruta: string, datos: Fija): MetaPagina {
  return {
    ruta,
    canonica: SITE_URL + ruta,
    tipo: "website",
    indexable: true,
    enMapa: true,
    imagen: IMAGEN_GENERAL,
    ...datos,
  };
}

/** La portada y la página 404 van en la descarga inicial; las demás fichas fijas están en
 * fichas.ts y llegan con su página. */
export const PAGINA_INICIO = pagina("/", {
  titulo: "Software para abogados: casos y evidencia digital" + MARCA,
  descripcion:
    "Software para abogados en Colombia: casos, equipo y evidencia digital con huella SHA-256, sello de tiempo RFC 3161 y paquete de preservación.",
});

export const PAGINA_NO_ENCONTRADA = pagina("/404", {
  titulo: "Página no encontrada" + MARCA,
  // No se indexa: no necesita descripción ni dirección canónica.
  descripcion: "",
  canonica: "",
  indexable: false,
  enMapa: false,
});
