import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function cargar() {
  vi.resetModules();
  return import("./media.ts");
}

it("sin red de distribución las imágenes salen del mismo origen", async () => {
  vi.stubEnv("VITE_CDN_URL", "");
  const { mediaUrl, productShotProps } = await cargar();

  expect(mediaUrl("/brand/symbol-dark.svg")).toBe("/brand/symbol-dark.svg");
  expect(productShotProps("/media/producto/tareas.webp", "50vw").srcSet).toBe(
    "/media/producto/tareas-640.webp?v=6 640w, /media/producto/tareas.webp?v=6 1260w, /media/producto/tareas-2520.webp?v=6 2520w",
  );
});

it("con red de distribución las imágenes se piden al subdominio, con o sin barra final", async () => {
  vi.stubEnv("VITE_CDN_URL", "https://cdn.aletheia.sbs/");
  const { mediaUrl, productShotProps } = await cargar();

  expect(mediaUrl("/brand/symbol-dark.svg")).toBe(
    "https://cdn.aletheia.sbs/brand/symbol-dark.svg",
  );
  expect(productShotProps("/media/producto/tareas.webp", "50vw")).toMatchObject(
    {
      src: "https://cdn.aletheia.sbs/media/producto/tareas.webp?v=6",
      srcSet:
        "https://cdn.aletheia.sbs/media/producto/tareas-640.webp?v=6 640w, https://cdn.aletheia.sbs/media/producto/tareas.webp?v=6 1260w, https://cdn.aletheia.sbs/media/producto/tareas-2520.webp?v=6 2520w",
    },
  );
});
