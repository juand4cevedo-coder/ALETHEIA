/** Fotografías de la campaña, publicadas en tres anchos WebP (640, 1280 y 1920 px). El
 * navegador elige el más cercano al tamaño con que se dibuja, así un teléfono no descarga la
 * imagen de escritorio. Los originales JPG ya no se publican. */
export type Photo = "hero-real" | "equipo-real" | "producto-real" | "pie";

const WIDTHS = [640, 1280, 1920] as const;

function file(photo: Photo, width: number): string {
  return `/media/campaign/${photo}-${width}.webp`;
}

/** Atributos de una imagen responsive: la versión intermedia como src y las tres en srcSet. */
export function photoProps(
  photo: Photo,
  sizes: string,
): { src: string; srcSet: string; sizes: string } {
  return {
    src: file(photo, 1280),
    srcSet: WIDTHS.map((width) => `${file(photo, width)} ${width}w`).join(", "),
    sizes,
  };
}

/** Versión pequeña, para miniaturas de menús y tarjetas. */
export function photoThumb(photo: Photo): string {
  return file(photo, 640);
}
