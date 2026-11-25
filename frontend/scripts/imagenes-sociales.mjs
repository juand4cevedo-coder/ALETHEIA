// Genera las imágenes para compartir (1200 x 630) de las páginas que tienen una propia, en
// public/og/. No corre en el build: se ejecuta a mano cuando se agrega un artículo o cambia
// un título, y las imágenes se versionan. Usa un navegador real con Playwright:
//
//   node scripts/imagenes-sociales.mjs scripts/imagenes-sociales.json
//
// La ruta de playwright-core se puede indicar con PLAYWRIGHT_CORE; por omisión se busca la
// instalación global de @playwright/cli. Una prueba (src/seo/imagenes.test.ts) exige que cada
// página que declara una imagen la tenga en public/og/.
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
// La fuente va dentro de la página: una página sin origen no puede leer archivos locales.
const inter =
  "data:font/woff2;base64," +
  readFileSync(
    join(
      raiz,
      "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
    ),
  ).toString("base64");
const simbolo = readFileSync(join(raiz, "public/brand/symbol-white.svg"), "utf8");

function escapar(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pagina({ etiqueta, titulo }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; src: url("${inter}") format("woff2-variations"); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #111111; color: #ffffff; font-family: Inter, sans-serif; }
.lienzo { position: relative; display: grid; grid-template-rows: auto 1fr auto; height: 100%; padding: 72px 80px 64px; }
.lienzo::before { content: ""; position: absolute; left: 80px; top: 0; width: 120px; height: 6px; background: #c99cf5; }
.marca { display: flex; align-items: center; gap: 18px; font-size: 30px; font-weight: 650; letter-spacing: 0.08em; }
.marca svg { width: 56px; height: 56px; }
.texto { align-self: center; display: grid; gap: 22px; }
.etiqueta { color: #c99cf5; font-size: 26px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
h1 { max-width: 1000px; font-size: ${titulo.length > 60 ? 58 : 68}px; font-weight: 600; line-height: 1.08; letter-spacing: -0.02em; text-wrap: balance; }
.pie { display: flex; justify-content: space-between; color: #b9b4c2; font-size: 24px; }
</style></head><body><div class="lienzo">
<div class="marca">${simbolo}<span>ALETHEIA</span></div>
<div class="texto"><p class="etiqueta">${escapar(etiqueta)}</p><h1>${escapar(titulo)}</h1></div>
<div class="pie"><span>Casos y evidencia digital para abogados en Colombia</span><span>aletheia.sbs</span></div>
</div></body></html>`;
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
