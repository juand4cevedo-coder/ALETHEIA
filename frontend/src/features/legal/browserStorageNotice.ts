import type { BrowserStorageName } from "../../config/browserStorage.ts";

// Para qué sirve y cuánto dura cada dato que el sitio guarda en el navegador. El tipo exige una
// entrada por cada clave de config/browserStorage.ts: una clave nueva no compila sin su
// explicación en la política de cookies.
export const BROWSER_STORAGE_NOTICE: Readonly<
  Record<BrowserStorageName, { purpose: string; duration: string }>
> = {
  cookieChoice: {
    purpose:
      "Su decisión sobre la medición de rendimiento y la fecha en que la tomó, para no preguntársela en cada visita.",
    duration: "Hasta que la cambie o borre los datos del sitio.",
  },
  sessionHint: {
    purpose:
      "Un aviso sin datos personales de que hay una sesión abierta, para mostrar «Ir a mis casos» en lugar de «Ingresar».",
    duration: "Se borra al cerrar la sesión o cuando la sesión vence.",
  },
  theme: {
    purpose: "El modo de color que eligió: claro, oscuro o el de su equipo.",
    duration: "Hasta que lo cambie o borre los datos del sitio.",
  },
  navigation: {
    purpose:
      "Si prefiere el menú lateral del espacio de trabajo abierto o compacto, y qué grupos dejó plegados.",
    duration: "Hasta que lo cambie o borre los datos del sitio.",
  },
};
