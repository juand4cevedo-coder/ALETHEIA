import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

// Red de distribución (CloudFront, cdn.aletheia.sbs). Con VITE_CDN_URL definida al construir,
// los archivos con huella de /assets y las imágenes de /media y /brand se piden a ese dominio.
// Sin ella (el valor por omisión) todo sale del mismo origen, como antes. El HTML, el manifiesto,
// los íconos y la API nunca pasan por la red de distribución.
const cdn = (process.env.VITE_CDN_URL ?? "").replace(/\/+$/, "");

// El HTML lleva la precarga de la foto de portada con una ruta fija. Se reescribe sobre el
// archivo ya generado, cuando Vite terminó de procesar las direcciones del HTML.
const cdnEnHtml: Plugin = {
  name: "aletheia-cdn-html",
  enforce: "post",
  generateBundle(_, bundle) {
    const html = bundle["index.html"];
    if (!cdn || html?.type !== "asset") return;
    // Dos precargas de conexión, al principio del head: el navegador abre conexiones separadas
    // para lo que pide con CORS (el script y las fuentes) y para lo que no (las imágenes), y
    // cada una paga su propio saludo de DNS, TCP y TLS. Así los saludos corren mientras se
    // descarga el HTML y no después.
    const precarga =
      `<head>\n    <link rel="preconnect" href="${cdn}" crossorigin />\n` +
      `    <link rel="preconnect" href="${cdn}" />`;
    const reescrito = String(html.source)
      .replace(/\/(?:media|brand)\/[^\s",]*/g, (ruta) => `${cdn}${ruta}`)
      .replace("<head>", precarga);
    if (!reescrito.includes('rel="preconnect"')) {
      throw new Error(
        "El index.html no tiene <head>: no se pudo precargar el CDN.",
      );
    }
    html.source = reescrito;
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cdnEnHtml],
  experimental: cdn
    ? {
        // Solo lo que Vite genera con huella; los íconos y el manifiesto de /public se quedan.
        renderBuiltUrl: (archivo) =>
          archivo.startsWith("assets/") ? `${cdn}/${archivo}` : undefined,
      }
    : undefined,
  build: {
    // El presupuesto recorre las importaciones estáticas del manifiesto, también las compartidas.
    manifest: true,
    // Todos los navegadores que soporta el sitio entienden modulepreload: el relleno sobra.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      treeshake: {
        // Los archivos de íconos no hacen nada al importarse. Declararlo deja que cada pantalla
        // descargue solo los íconos que dibuja, aunque todos pasen por components/ui/icons.tsx.
        moduleSideEffects: (id) => !/\/components\/ui\/icons[./]/.test(id),
      },
    },
  },
  server: {
    // En desarrollo, Vite reenvía /api a la API local: la interfaz llama al mismo origen,
    // igual que en producción con Caddy, y no hace falta abrir CORS.
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  // Pruebas de componentes (ADR-022): Vitest con un navegador simulado por jsdom.
  test: {
    // jsdom consume memoria por proceso; un equipo con muchos núcleos no necesita abrir
    // un navegador simulado por archivo a la vez.
    maxWorkers: 2,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    // Con dos procesos, una prueba que recorre varias pantallas diferidas y revisa la
    // accesibilidad con axe puede pasar de los 5 segundos por omisión sin estar colgada.
    testTimeout: 15_000,
  },
});
