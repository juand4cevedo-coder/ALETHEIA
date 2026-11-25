import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

// Versiones comprimidas de los archivos de texto, hechas una vez al construir y con el nivel
// más alto. Caddy las entrega tal cual (file_server precompressed) y no comprime en cada
// visita; Brotli pesa menos que gzip y Caddy no lo genera al vuelo.
export const EXTENSIONES = [
  ".html",
  ".js",
  ".css",
  ".svg",
  ".json",
  ".xml",
  ".txt",
  ".webmanifest",
];

/** Bytes por debajo de los cuales comprimir no compensa la cabecera de la respuesta. */
export const MINIMO = 512;

function archivos(carpeta) {
  // Las carpetas que empiezan con punto (.vite, el manifiesto de Vite) no se publican.
  return readdirSync(carpeta)
    .filter((nombre) => !nombre.startsWith("."))
    .flatMap((nombre) => {
      const ruta = join(carpeta, nombre);
      return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
    });
}

/** Escribe .br y .gz junto a cada archivo de texto de la carpeta. Devuelve cuántos comprimió. */
export function comprimirCarpeta(carpeta) {
  let comprimidos = 0;
  for (const ruta of archivos(carpeta)) {
    if (!EXTENSIONES.some((extension) => ruta.endsWith(extension))) continue;
    const contenido = readFileSync(ruta);
    if (contenido.byteLength < MINIMO) continue;
    const brotli = brotliCompressSync(contenido, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: contenido.byteLength,
      },
    });
    const gzip = gzipSync(contenido, { level: constants.Z_BEST_COMPRESSION });
    // Solo si de verdad pesa menos; si no, Caddy entrega el original.
    if (brotli.byteLength < contenido.byteLength)
      writeFileSync(ruta + ".br", brotli);
    if (gzip.byteLength < contenido.byteLength)
      writeFileSync(ruta + ".gz", gzip);
    comprimidos += 1;
  }
  return comprimidos;
}
