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
/** Versión de las capturas: /media se guarda una semana en el navegador, así que al rehacer las
 * capturas se sube este número para que se pidan de nuevo. */
const VERSION_CAPTURAS = "?v=6";

export function productShotProps(
  path: string,
  sizes: string,
): { src: string; srcSet: string; sizes: string } {
  const large = mediaUrl(path);
  const small = large.replace(/\.webp$/, "-640.webp");
  // La de 2520 px es la misma captura a doble densidad, para pantallas retina.
  const retina = large.replace(/\.webp$/, "-2520.webp");
  const v = VERSION_CAPTURAS;
  return {
    src: large + v,
    srcSet: `${small}${v} 640w, ${large}${v} 1260w, ${retina}${v} 2520w`,
    sizes,
  };
}
