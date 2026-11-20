import { ANCHOS, FOTOS, type NombreFoto } from "./fotos.ts";

/* Fotografía del producto: un `img` con `srcset` armado desde el nombre base.
 *
 * Es un `img` y no un `picture` porque hay un solo formato (WebP). La especificación, en 7.5,
 * explica por qué no hay AVIF. Los datos (nombres, anchos y proporciones) viven en fotos.ts. */

/* Ancho de respaldo del atributo src, para navegadores sin soporte de srcset. */
const ANCHO_RESPALDO = 800;

const ruta = (nombre: string, ancho: number) =>
  `/media/${nombre}-${ancho}.webp`;

export function Foto({
  nombre,
  alt,
  prioridad = false,
  sizes = "100vw",
  className,
}: {
  nombre: NombreFoto;
  /** Texto alternativo. Vacío si la fotografía es decorativa. */
  alt: string;
  /** Para la imagen que ya está en pantalla al cargar: se pide con prioridad y no se difiere. */
  prioridad?: boolean;
  /** Ancho que ocupa la imagen según el diseño. Sin él, el navegador supone todo el viewport y
   *  descarga el archivo mayor aun en una columna estrecha. */
  sizes?: string;
  className?: string;
}) {
  const { ancho, alto } = FOTOS[nombre];
  return (
    <img
      className={className}
      src={ruta(nombre, ANCHO_RESPALDO)}
      srcSet={ANCHOS.map((a) => `${ruta(nombre, a)} ${a}w`).join(", ")}
      sizes={sizes}
      width={ancho}
      height={alto}
      alt={alt}
      decoding="async"
      loading={prioridad ? undefined : "lazy"}
      fetchPriority={prioridad ? "high" : undefined}
    />
  );
}
