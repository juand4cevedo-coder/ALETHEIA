import type { RegisterRequest } from "../../api/generated";
import { LEGAL_VERSION } from "../../config/legal.ts";

// Mismos límites que la API (RN-025): la contraseña se mide ya normalizada, como se guarda.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
const NAME_MAX_LENGTH = 120;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SignUpValues = {
  fullName: string;
  email: string;
  password: string;
  organizationName: string;
  acceptsLegalTerms: boolean;
};

export type SignUpField = keyof SignUpValues;
export type SignUpErrors = Partial<Record<SignUpField, string>>;

// Orden de los campos en el formulario: el foco va al primero que tenga un error.
export const SIGN_UP_FIELDS: readonly SignUpField[] = [
  "fullName",
  "organizationName",
  "email",
  "password",
  "acceptsLegalTerms",
];

export const SIGN_UP_MESSAGES = {
  fullName: "Escriba su nombre.",
  email: "Escriba un correo válido, por ejemplo nombre@dominio.com.",
  // MSG-005.
  passwordShort: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  passwordLong: `La contraseña puede tener hasta ${PASSWORD_MAX_LENGTH} caracteres.`,
  passwordRange: `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`,
  organizationName: "Escriba el nombre de su oficina o firma.",
  acceptsLegalTerms:
    "Para crear la cuenta debe aceptar los términos y autorizar el tratamiento de sus datos.",
} as const;

/** Errores de cada campo, con los mismos criterios que aplica la API. */
export function validateSignUp(values: SignUpValues): SignUpErrors {
  const errors: SignUpErrors = {};
  const fullName = values.fullName.trim();
  const organizationName = values.organizationName.trim();
  const email = values.email.trim();
  const passwordLength = values.password.normalize("NFKC").length;

  if (!fullName || fullName.length > NAME_MAX_LENGTH) {
    errors.fullName = SIGN_UP_MESSAGES.fullName;
  }
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = SIGN_UP_MESSAGES.email;
  }
  if (passwordLength < PASSWORD_MIN_LENGTH) {
    errors.password = SIGN_UP_MESSAGES.passwordShort;
  } else if (passwordLength > PASSWORD_MAX_LENGTH) {
    errors.password = SIGN_UP_MESSAGES.passwordLong;
  }
  if (!organizationName || organizationName.length > NAME_MAX_LENGTH) {
    errors.organizationName = SIGN_UP_MESSAGES.organizationName;
  }
  if (!values.acceptsLegalTerms) {
    errors.acceptsLegalTerms = SIGN_UP_MESSAGES.acceptsLegalTerms;
  }
  return errors;
}

/** Cuerpo de POST /api/v1/auth/register. Lleva la versión legal que la persona tuvo a la vista. */
export function toRegisterRequest(values: SignUpValues): RegisterRequest {
  return {
    full_name: values.fullName.trim(),
    email: values.email.trim(),
    password: values.password,
    organization_name: values.organizationName.trim(),
    legal_version: LEGAL_VERSION,
    accepts_legal_terms: true,
  };
}

// Campo del formulario al que corresponde cada campo de la API, para mostrar ahí un 422.
const API_FIELDS: Record<string, SignUpField> = {
  full_name: "fullName",
  email: "email",
  password: "password",
  organization_name: "organizationName",
  accepts_legal_terms: "acceptsLegalTerms",
};

/** Traduce los errores de validación de la API a los mensajes de cada campo. */
export function fieldErrorsFromApi(
  errors: ReadonlyArray<{ loc: ReadonlyArray<string | number> }>,
): SignUpErrors {
  const result: SignUpErrors = {};
  for (const error of errors) {
    const field = API_FIELDS[String(error.loc.at(-1))];
    if (field === "password") {
      result.password = SIGN_UP_MESSAGES.passwordRange;
    } else if (field) {
      result[field] = SIGN_UP_MESSAGES[field];
    }
  }
  return result;
}
