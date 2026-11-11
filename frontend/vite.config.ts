import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Cada ícono de Phosphor trae sus seis pesos y la interfaz solo usa el regular (sección 6 del
// sistema de diseño). Este complemento deja únicamente ese peso en la compilación de producción
// y evita sumar al paquete cinco trazados que nadie dibuja. Si el formato del archivo cambia y
// no se reconoce, lo deja intacto: pesa más, pero funciona.
function soloPesoRegularDePhosphor(): Plugin {
  const ENTRADA = /\n {2}\[\n {4}"(bold|duotone|fill|light|regular|thin)",/g;
  return {
    name: "solo-peso-regular-de-phosphor",
    enforce: "pre",
    apply: "build",
    transform(codigo, id) {
      if (!id.includes("@phosphor-icons") || !id.includes("/dist/defs/")) {
        return null;
      }
      const inicios = [...codigo.matchAll(ENTRADA)];
      const regular = inicios.findIndex((m) => m[1] === "regular");
      const cierre = codigo.lastIndexOf("\n]);");
      if (regular === -1 || cierre === -1) return null;
      const desde = inicios[regular]!.index;
      const hasta = inicios[regular + 1]?.index ?? cierre;
      return (
        codigo.slice(0, inicios[0]!.index) +
        codigo.slice(desde, hasta) +
        codigo.slice(cierre)
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), soloPesoRegularDePhosphor()],
  server: {
    // En desarrollo, Vite reenvía /api a la API local: la interfaz llama al mismo origen,
    // igual que en producción con Caddy, y no hace falta abrir CORS.
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  // Pruebas de componentes (ADR-022): Vitest con un navegador simulado por jsdom.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
