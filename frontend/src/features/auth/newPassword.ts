import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SIGN_UP_MESSAGES,
} from "./signUp.ts";

/** Error de una contraseña nueva, con los mismos límites de la API (RN-025), o undefined si
 * sirve. Se mide ya normalizada, igual que se guarda. */
export function newPasswordError(password: string): string | undefined {
  const length = password.normalize("NFKC").length;
  if (length < PASSWORD_MIN_LENGTH) return SIGN_UP_MESSAGES.passwordShort;
  if (length > PASSWORD_MAX_LENGTH) return SIGN_UP_MESSAGES.passwordLong;
  return undefined;
}
