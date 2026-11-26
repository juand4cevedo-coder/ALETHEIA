// Rutas públicas del sitio, según el mapa de navegación del documento de Diseño (DIA-INF-01).
// Los enlaces las toman de aquí para que un cambio de ruta se haga en un solo lugar.
export const ROUTES = {
  home: "/",
  howItWorks: "/#como-le-ayuda",
  // Las garantías técnicas y su demostración, en el inicio.
  security: "/seguridad",
  pricing: "/precios",
  verifier: "/verificador",
  exportDownload: "/descargar-paquete",
  sharedEvidence: "/compartido",
  // La comprobación de una huella vive en la portada. La verificación de paquetes tiene
  // su propio alcance funcional (HU-026).
  signIn: "/ingresar",
  signUp: "/registro",
  signUpEmail: "/registro/correo",
  verifyEmail: "/verificar-correo",
  forgotPassword: "/recuperar",
  resetPassword: "/restablecer-contrasena",
  recoverTwoFactor: "/recuperar-segundo-factor",
  acceptInvitation: "/invitacion",
  clientPortal: "/portal",
  // Espacio de trabajo: todo lo que exige sesión vive bajo /app.
  app: "/app",
  account: "/app/cuenta",
  billing: "/app/facturacion",
  // Consola de la cuenta propietaria: cada pantalla una sola tarea.
  platform: "/app/plataforma",
  platformOrganizations: "/app/plataforma/despachos",
  platformAccounts: "/app/plataforma/cuentas",
  platformPlans: "/app/plataforma/planes",
  platformBilling: "/app/plataforma/facturacion",
  platformSupport: "/app/plataforma/soporte",
  platformOperations: "/app/plataforma/operacion",
  platformAudit: "/app/plataforma/auditoria",
  platformVitals: "/app/plataforma/rendimiento",
  support: "/app/soporte",
  organization: "/app/organizacion",
  members: "/app/miembros",
  organizationAudit: "/app/auditoria",
  calendar: "/app/calendario",
  taskTemplates: "/app/plantillas",
  cases: "/app/casos",
  archive: "/app/banco-de-datos",
  newCase: "/app/casos/nuevo",
  caseDetail: (id: string) => `/app/casos/${id}`,
  evidenceDetail: (caseId: string, evidenceId: string) =>
    `/app/casos/${caseId}/evidencias/${evidenceId}`,
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
