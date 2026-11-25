// HTML propio para cada página pública, después de `vite build`. Construye src/seo/servidor.tsx
// para Node con la misma configuración de Vite, dibuja cada página con React y escribe
// dist/<ruta>/index.html con su título, descripción, dirección canónica, Open Graph y datos
// estructurados; además dist/404.html, dist/aplicacion.html (las pantallas con sesión),
// dist/sitemap.xml y dist/rutas-aplicacion.caddy, que la imagen de Caddy importa. Al final
// comprime los archivos de texto en Brotli y gzip.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

import { comprimirCarpeta } from "./prerender/comprimir.mjs";
import { prepararNavegador } from "./prerender/navegador.mjs";

const raiz = new URL("../", import.meta.url);
const dist = new URL("dist/", raiz);
const salida = new URL("node_modules/.cache/aletheia-prerender/", raiz);
const envoltorio = fileURLToPath(
  new URL("prerender/react-servidor.mjs", import.meta.url),
);

// Todo lo que importa «react», salvo el envoltorio mismo, recibe el envoltorio.
const reactDelPrerender = {
  name: "aletheia-react-del-prerender",
  enforce: "pre",
  resolveId(fuente, importador) {
    if (fuente !== "react" || !importador) return null;
    return importador.endsWith("react-servidor.mjs") ? null : envoltorio;
  },
};

await build({
  root: fileURLToPath(raiz),
  logLevel: "warn",
  plugins: [reactDelPrerender],
  build: {
    ssr: "src/seo/servidor.tsx",
    outDir: fileURLToPath(salida),
    emptyOutDir: true,
    copyPublicDir: false,
    manifest: false,
  },
});

const ventana = prepararNavegador("https://aletheia.sbs");
const { generarSitio } = await import(
  pathToFileURL(fileURLToPath(new URL("servidor.js", salida))).href
);

const plantilla = readFileSync(new URL("index.html", dist), "utf8");
// La fecha de construcción en Colombia, para el lastmod de las páginas sin fecha propia.
const fecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
}).format(new Date());
const sitio = await generarSitio(plantilla, fecha);

for (const [archivo, html] of sitio.archivos) {
  const destino = new URL(archivo, dist);
  mkdirSync(dirname(fileURLToPath(destino)), { recursive: true });
  writeFileSync(destino, html);
}
writeFileSync(new URL("sitemap.xml", dist), sitio.mapa);
writeFileSync(new URL("rutas-aplicacion.caddy", dist), sitio.caddy);
rmSync(salida, { recursive: true, force: true });

const comprimidos = comprimirCarpeta(fileURLToPath(dist));
console.log(
  `Prerender: ${sitio.archivos.size} páginas, mapa del sitio y ${comprimidos} archivos comprimidos.`,
);
// El navegador simulado deja temporizadores abiertos y Node no saldría solo.
ventana.close();
process.exit(0);
