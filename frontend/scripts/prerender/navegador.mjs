import { JSDOM } from "jsdom";

// Varias pantallas leen el almacenamiento local, la dirección o el documento mientras se dibujan.
// El prerender corre en Node: les da un navegador simulado (el mismo jsdom de las pruebas),
// sin estado guardado y en la dirección pública del sitio.
const GLOBALES = [
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "location",
  "navigator",
];

export function prepararNavegador(sitio) {
  const dom = new JSDOM(
    "<!doctype html><html><head></head><body></body></html>",
    {
      url: sitio + "/",
      pretendToBeVisual: true,
    },
  );
  const ventana = dom.window;
  ventana.matchMedia ??= (consulta) => ({
    matches: false,
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  ventana.scrollTo = () => {};
  const nombres = new Set([
    ...GLOBALES,
    ...Object.getOwnPropertyNames(ventana),
  ]);
  for (const nombre of nombres) {
    if (nombre in globalThis && !GLOBALES.includes(nombre)) continue;
    try {
      Object.defineProperty(globalThis, nombre, {
        configurable: true,
        get: () => ventana[nombre],
      });
    } catch {
      // Algunas propiedades de Node no se pueden reemplazar; no hacen falta para dibujar.
    }
  }
  return ventana;
}
