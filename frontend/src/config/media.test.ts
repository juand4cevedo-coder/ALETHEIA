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
    "/media/producto/tareas-640.webp 640w, /media/producto/tareas.webp 1260w, /media/producto/tareas-2520.webp 2520w",
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
      src: "https://cdn.aletheia.sbs/media/producto/tareas.webp",
      srcSet:
        "https://cdn.aletheia.sbs/media/producto/tareas-640.webp 640w, https://cdn.aletheia.sbs/media/producto/tareas.webp 1260w, https://cdn.aletheia.sbs/media/producto/tareas-2520.webp 2520w",
    },
  );
});

it("las fotografías de pantalla completa traen su versión de 2560 px", async () => {
  vi.stubEnv("VITE_CDN_URL", "");
  const { fotoProps, fotoMiniatura } = await cargar();

  expect(fotoProps("abogada", "50vw").srcSet).toContain(
    "/media/fotos/abogada-2560.webp 2560w",
  );
  expect(fotoProps("socios", "50vw").srcSet).not.toContain("2560w");
  expect(fotoMiniatura("abogado")).toBe("/media/fotos/abogado-640.webp");
});
