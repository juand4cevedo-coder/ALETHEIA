import type { LoginRequest } from "../../api/generated";
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN, SIGN_UP_MESSAGES } from "./signUp.ts";

export type SignInValues = { email: string; password: string };
export type SignInField = keyof SignInValues;
export type SignInErrors = Partial<Record<SignInField, string>>;

// Orden de los campos en el formulario: el foco va al primero que tenga un error.
export const SIGN_IN_FIELDS: readonly SignInField[] = ["email", "password"];

export const SIGN_IN_MESSAGES = {
  email: SIGN_UP_MESSAGES.email,
  password: "Escriba su contraseña.",
  // MSG-002. La segunda frase llega con la recuperación de la contraseña (HU-010).
  invalidCredentials:
    "El correo o la contraseña no coinciden. Revise los datos.",
} as const;

/** Errores de cada campo antes de enviar. La longitud de la contraseña no se juzga aquí: una
 * contraseña corta simplemente no coincide, y decirlo aparte no ayuda a nadie. */
export function validateSignIn(values: SignInValues): SignInErrors {
  const errors: SignInErrors = {};
  const email = values.email.trim();
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = SIGN_IN_MESSAGES.email;
  }
  if (values.password.length === 0) {
    errors.password = SIGN_IN_MESSAGES.password;
  }
  return errors;
}

/** Cuerpo de POST /api/v1/auth/login. La contraseña viaja tal cual: la API la normaliza. */
export function toLoginRequest(values: SignInValues): LoginRequest {
  return { email: values.email.trim(), password: values.password };
}

/** A dónde volver después de ingresar (NAV-003): la pantalla de /app que la persona intentaba
 * abrir, o el inicio del espacio de trabajo. Solo se aceptan rutas internas de /app, así que
 * nadie puede usar el ingreso para mandar a la persona a otro sitio. */
export function destinationAfterSignIn(
  from: unknown,
  fallback: string,
): string {
  if (
    typeof from === "string" &&
    (from === fallback || from.startsWith(`${fallback}/`)) &&
    !from.includes("//")
  ) {
    return from;
  }
  return fallback;
}
