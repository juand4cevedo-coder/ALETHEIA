// Catálogo de mensajes de la interfaz (documento de Diseño UX/UI, sección 14.2). Cada texto
// lleva su código MSG para rastrearlo desde el documento hasta la pantalla que lo muestra. Un
// mensaje que cambie aquí debe cambiar también en el catálogo, y al revés.

export const MESSAGES = {
  /** MSG-001. Cuenta creada (UI-006 y UI-007). */
  accountCreated:
    "Le enviamos un enlace de verificación a su correo. Ábralo para activar la cuenta.",
  /** MSG-002. Ingreso fallido; el mismo exista o no la cuenta (RN-026). */
  invalidCredentials:
    "El correo o la contraseña no coinciden. Revise los datos o recupere su contraseña.",
  /** MSG-003. Recuperación solicitada; el mismo exista o no la cuenta (RN-026). */
  recoveryRequested:
    "Si el correo está registrado, recibirá un enlace para crear una contraseña nueva.",
  /** MSG-004. Demasiados intentos (RN-026). */
  tooManyAttempts:
    "Hizo varios intentos seguidos. Espere 15 minutos e inténtelo de nuevo.",
  /** MSG-005. Contraseña corta (RN-025). */
  passwordTooShort: "La contraseña debe tener al menos 12 caracteres.",
  /** MSG-011. Lo pedido no existe o es de otra organización; no revela cuál de los dos es. */
  notFound: "No encontramos lo que busca o no tiene acceso a ello.",
  /** MSG-012. Sesión expirada (UI-027, NAV-004). */
  sessionExpired:
    "Su sesión terminó por seguridad. Ingrese de nuevo para continuar donde iba.",
} as const;

/** MSG-019. Error del sistema: el resto del mensaje lleva el correo y, si la API lo da, el
 * código de la solicitud. */
export const SYSTEM_ERROR_LEAD =
  "No pudimos completar la operación. Inténtelo de nuevo; si continúa, escríbanos a";
