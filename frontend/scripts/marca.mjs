// Genera los archivos de la marca en public/ a partir de src/brand/geometria.ts: el símbolo en
// sus tres variantes, el emblema, el logotipo, los íconos PNG y el favicon.ico. Se corre a mano
// cuando cambia la geometría y los archivos se versionan:
//
//   node scripts/marca.mjs
//
// Para los PNG usa Playwright, como scripts/imagenes-sociales.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import {
  COLORES_MARCA as C,
  emblemaSvg,
  grabadoSvg,
  logotipoSvg,
  simboloSvg,
} from "../src/brand/geometria.ts";

const raiz = resolve(import.meta.dirname, "..");
const publico = join(raiz, "public");
mkdirSync(join(publico, "brand"), { recursive: true });

const archivos = {
  // Modo claro: recuadro de tinta.
  "brand/symbol-dark.svg": simboloSvg(C.tinta, C.papel, C.laton),
  // Modo oscuro: el recuadro sube de tono para no perderse en el fondo casi negro.
  "brand/symbol-dark-mode.svg": simboloSvg(C.tintaClara, C.papel, C.laton),
  // Sobre fondos de color o fotos: recuadro blanco y ojo de tinta.
  "brand/symbol-white.svg": simboloSvg(C.papel, C.tinta, C.latonOscuro),
  "brand/emblema.svg": emblemaSvg(C.tinta, C.latonOscuro),
  "brand/emblema-oscuro.svg": emblemaSvg("#eeebf2", C.laton),
  "brand/logotipo.svg": logotipoSvg(C.tinta),
  "brand/logotipo-blanco.svg": logotipoSvg(C.papel),
  "brand/grabado.svg": grabadoSvg(),
  "favicon.svg": simboloSvg(C.tinta, C.papel, C.laton, "small"),
};
for (const [ruta, contenido] of Object.entries(archivos)) {
  writeFileSync(join(publico, ruta), contenido + "\n");
}

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE ??
    join(
      process.env.APPDATA ?? "",
      "npm/node_modules/@playwright/cli/node_modules/playwright-core",
    ),
);
const navegador = await chromium.launch({ channel: "msedge" });
const hoja = await (
  await navegador.newContext({ deviceScaleFactor: 1 })
).newPage();

async function png(svg, tam, ruta, margen = 0) {
  await hoja.setViewportSize({ width: tam, height: tam });
  await hoja.setContent(
    `<html><body style="margin:0;background:transparent"><div style="width:${tam}px;height:${tam}px;padding:${margen}px;box-sizing:border-box">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body></html>`,
  );
  return hoja.screenshot({
    path: ruta ? join(publico, ruta) : undefined,
    omitBackground: true,
  });
}

const simbolo = archivos["favicon.svg"];
await png(simbolo, 32, "favicon.png");
await png(simbolo, 192, "icon-192.png");
await png(simbolo, 512, "icon-512.png");
// El ícono de iOS no admite transparencia: se dibuja a sangre, iOS redondea las esquinas.
await png(simbolo.replace('rx="15"', 'rx="0"'), 180, "apple-touch-icon.png");

// favicon.ico con tres tamaños en PNG, el formato que aceptan todos los navegadores actuales.
const tamanos = [16, 32, 48];
const imagenes = [];
for (const t of tamanos) imagenes.push(await png(simbolo, t));
const cabecera = Buffer.alloc(6 + 16 * tamanos.length);
cabecera.writeUInt16LE(0, 0);
cabecera.writeUInt16LE(1, 2);
cabecera.writeUInt16LE(tamanos.length, 4);
let desplazamiento = cabecera.length;
tamanos.forEach((t, i) => {
  const o = 6 + 16 * i;
  cabecera.writeUInt8(t, o);
  cabecera.writeUInt8(t, o + 1);
  cabecera.writeUInt16LE(1, o + 4);
  cabecera.writeUInt16LE(32, o + 6);
  cabecera.writeUInt32LE(imagenes[i].length, o + 8);
  cabecera.writeUInt32LE(desplazamiento, o + 12);
  desplazamiento += imagenes[i].length;
});
writeFileSync(
  join(publico, "favicon.ico"),
  Buffer.concat([cabecera, ...imagenes]),
);

// Símbolo para los correos, cuadrado de 128 px: el texto del correo ya lleva el nombre.
await png(simbolo, 128, "email/logo-claro.png");

await navegador.close();
console.log("Marca generada:", Object.keys(archivos).length, "SVG y los PNG");
