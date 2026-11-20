/* Datos de las fotografías del producto, separados del componente para que Foto.tsx solo
 * exporte un componente (si no, la recarga en caliente recarga la página entera).
 *
 * AGREGAR UNA FOTOGRAFÍA: dejar sus cuatro derivados en `public/media/<nombre>-<ancho>.webp` y
 * añadir una línea a FOTOS con el tamaño del derivado de 1600 px. Foto.test.tsx lee cada
 * archivo y compara sus dimensiones reales con este mapa, así que un nombre mal escrito, un
 * ancho que falta o una proporción equivocada hacen fallar la prueba. Sin ese control el
 * navegador no pinta nada y no avisa. */

/** Anchos de los derivados, en píxeles. Cada fotografía tiene un archivo por ancho. */
export const ANCHOS = [400, 800, 1200, 1600] as const;

/* Cada fotografía se recorta en origen a la proporción de su sección, así que no comparten una:
 * un width/height único produciría salto de maquetación en tres de las cuatro. Se declara el
 * tamaño del derivado mayor; el navegador solo usa la proporción. */
export const FOTOS = {
  seguridad: { ancho: 1600, alto: 900 },
  cierre: { ancho: 1600, alto: 900 },
  pie: { ancho: 1600, alto: 800 },
  acceso: { ancho: 1600, alto: 2000 },
} as const;

export type NombreFoto = keyof typeof FOTOS;
