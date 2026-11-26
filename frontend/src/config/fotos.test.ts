import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function cargar() {
  vi.resetModules();
  return import("./fotos.ts");
}

it("las fotografías traen su versión de 2560 px para pantallas retina", async () => {
  vi.stubEnv("VITE_CDN_URL", "");
  const { fotoProps } = await cargar();

  expect(fotoProps("cliente", "50vw").srcSet).toContain(
    "/media/fotos/cliente-2560.webp 2560w",
  );
});

it("con red de distribución las fotos se piden al subdominio", async () => {
  vi.stubEnv("VITE_CDN_URL", "https://cdn.aletheia.sbs/");
  const { fotoProps } = await cargar();

  expect(fotoProps("firma", "100vw").src).toBe(
    "https://cdn.aletheia.sbs/media/fotos/firma-1280.webp",
  );
});
