// Rutas públicas del sitio, según el mapa de navegación del documento de Diseño (DIA-IA-01).
// Los enlaces las toman de aquí para que un cambio de ruta se haga en un solo lugar.
export const ROUTES = {
  home: "/",
  howItWorks: "/#como-funciona",
  // Las garantías técnicas y su demostración, en el inicio.
  security: "/#seguridad",
  pricing: "/precios",
  verifier: "/verificador",
  // La comprobación de una huella vive en la portada. La verificación de paquetes tiene
  // su propio alcance funcional (HU-026).
  verifierSection: "/#verificador",
  signIn: "/ingresar",
  signUp: "/registro",
  verifyEmail: "/verificar-correo",
  forgotPassword: "/recuperar",
  resetPassword: "/restablecer-contrasena",
  acceptInvitation: "/invitacion",
  // Espacio de trabajo: todo lo que exige sesión vive bajo /app.
  app: "/app",
  account: "/app/cuenta",
  platform: "/app/plataforma",
  members: "/app/miembros",
  cases: "/app/casos",
  newCase: "/app/casos/nuevo",
  caseDetail: (id: string) => `/app/casos/${id}`,
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
