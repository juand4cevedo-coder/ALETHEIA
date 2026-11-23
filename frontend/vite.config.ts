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
    html.source = String(html.source).replace(
      /\/(?:media|brand)\/[^\s",]*/g,
      (ruta) => `${cdn}${ruta}`,
    );
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
  },
});
