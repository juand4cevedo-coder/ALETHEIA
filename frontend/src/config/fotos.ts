// Fotografías del sitio. Va aparte de media.ts para que la portada, que solo usa fotos, no cargue
// también el código de las capturas del producto. Usa el mismo dominio de distribución.
const CDN = String(import.meta.env.VITE_CDN_URL ?? "").replace(/\/+$/, "");

/** Fotografías editoriales de Unsplash (licencia gratuita, créditos en docs/diseno/imagenes.md),
 * en WebP a 640, 1280, 1920 y 2560 px, este último para pantallas retina grandes. El navegador elige el ancho con srcset y sizes. */
export type Foto =
  | "abogado-portada"
  | "abogado-llamada"
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

function fotoUrl(foto: Foto, ancho: number): string {
  return `${CDN}/media/fotos/${foto}-${ancho}.webp`;
}

/** Atributos de una fotografía responsive. `sizes` dice cuánto ocupa en pantalla. */
export function fotoProps(
  foto: Foto,
  sizes: string,
): { src: string; srcSet: string; sizes: string } {
  return {
    src: fotoUrl(foto, 1280),
    srcSet: [640, 1280, 1920, 2560]
      .map((ancho) => `${fotoUrl(foto, ancho)} ${ancho}w`)
      .join(", "),
    sizes,
  };
}
