// Genera las imágenes para compartir (1200 x 630) de las páginas que tienen una propia, en
// public/og/. No corre en el build: se ejecuta a mano cuando se agrega un artículo o cambia
// un título, y las imágenes se versionan. Usa un navegador real con Playwright:
//
//   node scripts/imagenes-sociales.mjs scripts/imagenes-sociales.json
//
// La ruta de playwright-core se puede indicar con PLAYWRIGHT_CORE; por omisión se busca la
// instalación global de @playwright/cli. Una prueba (src/seo/imagenes.test.ts) exige que cada
// página que declara una imagen la tenga en public/og/. La marca sale de public/brand, que
// genera scripts/marca.mjs.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const ruta =
  process.env.PLAYWRIGHT_CORE ??
  join(
    process.env.APPDATA ?? "",
    "npm/node_modules/@playwright/cli/node_modules/playwright-core",
  );
const { chromium } = require(ruta);

const raiz = resolve(import.meta.dirname, "..");
const lista = JSON.parse(readFileSync(process.argv[2], "utf8"));

// Las fuentes van dentro de la página: una página sin origen no puede leer archivos locales.
const fuente = (archivo) =>
  "data:font/woff2;base64," +
  readFileSync(
    join(raiz, "node_modules/@fontsource-variable", archivo),
  ).toString("base64");
const GEIST = fuente("geist/files/geist-latin-wght-normal.woff2");
const NEWSREADER = fuente(
  "newsreader/files/newsreader-latin-opsz-normal.woff2",
);
const marca = (archivo) =>
  readFileSync(join(raiz, "public/brand", archivo), "utf8");
const SIMBOLO = marca("symbol-dark-mode.svg");
const LOGOTIPO = marca("logotipo-blanco.svg");
const EMBLEMA = marca("emblema-oscuro.svg");

function escapar(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const ESTILO = `
@font-face { font-family: Geist; src: url("${GEIST}") format("woff2-variations"); font-weight: 100 900; }
@font-face { font-family: News; src: url("${NEWSREADER}") format("woff2-variations"); font-weight: 200 800; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #121016; color: #eeebf2; font-family: Geist, sans-serif; overflow: hidden; }
.lienzo { position: relative; display: grid; grid-template-rows: auto 1fr auto; height: 100%; padding: 68px 80px 60px; }
.emblema { position: absolute; right: -150px; top: 50%; width: 560px; height: 560px; transform: translateY(-50%); opacity: 0.45; }
.emblema svg { width: 100%; height: 100%; }
.marca { position: relative; display: flex; align-items: center; gap: 18px; }
.marca > svg:first-child { width: 52px; height: 52px; }
.marca > svg:last-child { height: 22px; width: auto; }
.texto { position: relative; align-self: center; display: grid; gap: 20px; max-width: 820px; }
.etiqueta { color: #d9b871; font-size: 22px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
h1 { font-family: News, serif; font-weight: 440; line-height: 1.06; letter-spacing: -0.018em; text-wrap: balance; font-variation-settings: "opsz" 72; }
.pie { position: relative; display: flex; justify-content: space-between; color: #bdb7c6; font-size: 22px; border-top: 1px solid #2b2732; padding-top: 22px; }
`;

function pagina({ etiqueta, titulo }) {
  const tamano = titulo.length > 60 ? 56 : 66;
  return [
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${ESTILO}</style></head><body>`,
    `<div class="lienzo">`,
    `<div class="emblema">${EMBLEMA}</div>`,
    `<div class="marca">${SIMBOLO}${LOGOTIPO}</div>`,
    `<div class="texto"><p class="etiqueta">${escapar(etiqueta)}</p><h1 style="font-size:${tamano}px">${escapar(titulo)}</h1></div>`,
    `<div class="pie"><span>Casos y evidencia digital para abogados en Colombia</span><span>aletheia.sbs</span></div>`,
    `</div></body></html>`,
  ].join("");
}

const navegador = await chromium.launch({ channel: "msedge" });
const contexto = await navegador.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
const hoja = await contexto.newPage();
for (const item of lista) {
  await hoja.setContent(pagina(item), { waitUntil: "load" });
  await hoja.evaluate(() => document.fonts.ready);
  const archivo = join(raiz, "public", item.imagen);
  await hoja.screenshot({ path: archivo, type: "png" });
  console.log(archivo);
}
await navegador.close();
