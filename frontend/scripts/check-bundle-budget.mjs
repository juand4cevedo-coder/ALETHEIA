import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Presupuesto de la entrada pública, en bytes gzip (1 kB = 1000 bytes).
// Se cuentan una sola vez los módulos compartidos. Las rutas diferidas no forman
// parte de este límite; sus descargas se miden aparte en el navegador.
const dist = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL(".vite/manifest.json", dist), "utf8"),
);
const visited = new Set();
const javascript = new Set();
const styles = new Set();

function visit(key) {
  if (visited.has(key)) return;
  const chunk = manifest[key];
  if (!chunk?.file) throw new Error(`Falta ${key} en el manifiesto de Vite`);
  visited.add(key);
  if (chunk.file.endsWith(".js")) javascript.add(chunk.file);
  if (chunk.file.endsWith(".css")) styles.add(chunk.file);
  for (const file of chunk.css ?? []) styles.add(file);
  for (const dependency of chunk.imports ?? []) visit(dependency);
}

if (!manifest["index.html"]?.isEntry) {
  throw new Error("No se encontró la entrada de la landing en el manifiesto");
}
visit("index.html");

let exceeded = false;
for (const [label, files, limit] of [
  ["JavaScript inicial", javascript, 120_000],
  ["CSS inicial", styles, 30_000],
]) {
  let total = 0;
  for (const file of files) {
    total += gzipSync(readFileSync(new URL(file, dist))).byteLength;
  }
  console.log(
    `${label}: ${(total / 1000).toFixed(2)} kB gzip; límite < ${limit / 1000} kB (${files.size} archivos)`,
  );
  if (total >= limit) exceeded = true;
}
if (exceeded) {
  console.error("La landing excede su presupuesto de carga.");
  process.exitCode = 1;
}
