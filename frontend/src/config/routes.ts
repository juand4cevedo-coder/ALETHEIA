// Rutas públicas del sitio, según el mapa de navegación del documento de Diseño (DIA-IA-01).
// Los enlaces las toman de aquí para que un cambio de ruta se haga en un solo lugar.
export const ROUTES = {
  home: "/",
  howItWorks: "/#como-funciona",
  pricing: "/precios",
  verifier: "/verificador",
  // Mientras el verificador público no existe (HU-026), la navegación lleva a la sección de la
  // portada que lo explica, nunca a una página vacía.
  verifierSection: "/#verificador",
  signIn: "/ingresar",
  signUp: "/registro",
  verifyEmail: "/verificar-correo",
  forgotPassword: "/recuperar",
  resetPassword: "/restablecer-contrasena",
  // Espacio de trabajo: todo lo que exige sesión vive bajo /app.
  app: "/app",
  account: "/app/cuenta",
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
