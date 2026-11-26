/** Dominio de la red de distribución (cdn.aletheia.sbs), definido al construir con VITE_CDN_URL.
 * Vacío por omisión: las imágenes salen del mismo origen. */
const CDN = String(import.meta.env.VITE_CDN_URL ?? "").replace(/\/+$/, "");

/** Dirección de un archivo público de /media o /brand, por la red de distribución si está activa. */
export function mediaUrl(path: string): string {
  return CDN + path;
}

/** Capturas del producto: cada una se publica en 640, 1260 y 2520 px de ancho. Un teléfono, que las
 * dibuja a unos 340 px, descarga la de 640 (un 70 % más liviana). `path` es la ruta de la captura
 * grande, por ejemplo «/media/producto/tareas.webp». */
export function productShotProps(
  path: string,
  sizes: string,
): { src: string; srcSet: string; sizes: string } {
  const large = mediaUrl(path);
  const small = large.replace(/\.webp$/, "-640.webp");
  // La de 2520 px es la misma captura a doble densidad, para pantallas retina.
  const retina = large.replace(/\.webp$/, "-2520.webp");
  return {
    src: large,
    srcSet: `${small} 640w, ${large} 1260w, ${retina} 2520w`,
    sizes,
  };
}

/** Fotografías editoriales de Unsplash (licencia gratuita, créditos en docs/diseno/imagenes.md),
 * en WebP a 640, 1280 y 1920 px; las que van a pantalla completa suman 2560 px para pantallas
 * retina grandes. El navegador elige el ancho con srcset y sizes. */
export type Foto =
  | "abogada"
  | "abogada-2"
  | "abogado"
  | "cliente"
  | "equipo"
  | "acuerdo"
  | "socio"
  | "despacho"
  | "medellin"
  | "firma"
  | "reunion"
  | "revision"
  | "directora"
  | "expediente"
  | "ciudad"
  | "socios";

const CON_2560: ReadonlySet<Foto> = new Set<Foto>([
  "abogada",
  "cliente",
  "equipo",
  "acuerdo",
  "despacho",
  "reunion",
  "directora",
  "firma",
  "medellin",
  "ciudad",
]);

function fotoUrl(foto: Foto, ancho: number): string {
  return mediaUrl(`/media/fotos/${foto}-${ancho}.webp`);
}

/** Atributos de una fotografía responsive. `sizes` dice cuánto ocupa en pantalla. */
export function fotoProps(
  foto: Foto,
  sizes: string,
): { src: string; srcSet: string; sizes: string } {
  const anchos = CON_2560.has(foto)
    ? [640, 1280, 1920, 2560]
    : [640, 1280, 1920];
  return {
    src: fotoUrl(foto, 1280),
    srcSet: anchos
      .map((ancho) => `${fotoUrl(foto, ancho)} ${ancho}w`)
      .join(", "),
    sizes,
  };
}

/** Versión pequeña, para avatares y miniaturas. */
export function fotoMiniatura(foto: Foto): string {
  return fotoUrl(foto, 640);
}
