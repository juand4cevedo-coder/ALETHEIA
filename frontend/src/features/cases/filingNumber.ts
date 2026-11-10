// Número de radicación de un proceso judicial colombiano: 23 dígitos en ocho partes.
export const FILING_PARTS: readonly { label: string; length: number }[] = [
  { label: "Depto.", length: 2 },
  { label: "Ciudad", length: 3 },
  { label: "Entidad", length: 2 },
  { label: "Especialidad", length: 2 },
  { label: "Despacho", length: 3 },
  { label: "Año", length: 4 },
  { label: "Consec.", length: 5 },
  { label: "Recurso", length: 2 },
];

export const FILING_LENGTH = FILING_PARTS.reduce(
  (sum, part) => sum + part.length,
  0,
);

/** Quita espacios, puntos y guiones: así se acepta un radicado pegado con separadores. */
export function normalizeFilingNumber(input: string): string {
  return input.replace(/[\s.-]/g, "");
}

/** Recibe el radicado ya normalizado: solo es válido con 23 dígitos exactos. */
export function isValidFilingNumber(digits: string): boolean {
  return digits.length === FILING_LENGTH && /^[0-9]+$/.test(digits);
}

/** Divide los dígitos en las ocho partes; con un radicado incompleto, las últimas quedan cortas
 * o vacías. */
export function splitFilingNumber(digits: string): string[] {
  let start = 0;
  return FILING_PARTS.map(({ length }) => {
    const part = digits.slice(start, start + length);
    start += length;
    return part;
  });
}

/** "11001 31 05 003 2026 00143 00": departamento y ciudad juntos, el resto en bloques. */
export function formatFilingNumber(digits: string): string {
  const [department = "", city = "", ...rest] = splitFilingNumber(digits);
  return [`${department}${city}`, ...rest].filter(Boolean).join(" ");
}
