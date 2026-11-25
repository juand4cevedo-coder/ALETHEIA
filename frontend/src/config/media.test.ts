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
  const { mediaUrl, photoProps, productShotProps } = await cargar();

  expect(mediaUrl("/brand/symbol-dark.svg")).toBe("/brand/symbol-dark.svg");
  expect(photoProps("hero-real", "100vw").src).toBe(
    "/media/campaign/hero-real-1280.webp",
  );
  expect(productShotProps("/media/producto/tareas.webp", "50vw").srcSet).toBe(
    "/media/producto/tareas-640.webp 640w, /media/producto/tareas.webp 1260w, /media/producto/tareas-2520.webp 2520w",
  );
});

it("con red de distribución las imágenes se piden al subdominio, con o sin barra final", async () => {
  vi.stubEnv("VITE_CDN_URL", "https://cdn.aletheia.sbs/");
  const { mediaUrl, photoProps, photoThumb, productShotProps } = await cargar();

  expect(mediaUrl("/brand/symbol-dark.svg")).toBe(
    "https://cdn.aletheia.sbs/brand/symbol-dark.svg",
  );
  expect(photoThumb("pie")).toBe(
    "https://cdn.aletheia.sbs/media/campaign/pie-640.webp",
  );
  expect(photoProps("equipo-real", "50vw").srcSet).toContain(
    "https://cdn.aletheia.sbs/media/campaign/equipo-real-1920.webp 1920w",
  );
  expect(productShotProps("/media/producto/tareas.webp", "50vw")).toMatchObject(
    {
      src: "https://cdn.aletheia.sbs/media/producto/tareas.webp",
      srcSet:
        "https://cdn.aletheia.sbs/media/producto/tareas-640.webp 640w, https://cdn.aletheia.sbs/media/producto/tareas.webp 1260w, https://cdn.aletheia.sbs/media/producto/tareas-2520.webp 2520w",
    },
  );
});
