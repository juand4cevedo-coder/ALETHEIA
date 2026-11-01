// Rutas públicas del sitio, según el mapa de navegación del documento de Diseño (DIA-IA-01).
// Los enlaces las toman de aquí para que un cambio de ruta se haga en un solo lugar.
export const ROUTES = {
  home: "/",
  howItWorks: "/#como-funciona",
  pricing: "/precios",
  verifier: "/verificador",
  signIn: "/ingresar",
  signUp: "/registro",
} as const;

export const LEGAL_PAGES = [
  { slug: "privacidad", label: "Privacidad" },
  { slug: "terminos", label: "Términos" },
  { slug: "cookies", label: "Cookies" },
  { slug: "reembolsos", label: "Reembolsos" },
] as const;

export type LegalSlug = (typeof LEGAL_PAGES)[number]["slug"];

export function legalRoute(slug: LegalSlug): string {
  return `/legal/${slug}`;
}
