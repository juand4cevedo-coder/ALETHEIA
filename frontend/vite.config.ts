import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
