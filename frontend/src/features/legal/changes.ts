import { LEGAL_VERSION } from "../../config/legal.ts";

// Qué cambió en cada fecha de los textos legales, en lenguaje sencillo. Es lo primero que lee
// quien tiene que aceptar unos textos nuevos (TT-012), así que cada fecha nueva de
// LEGAL_VERSION necesita aquí su resumen; una prueba lo exige. Solo resume: lo que rige es el
// texto completo de cada política.
export const LEGAL_CHANGES: Readonly<Record<string, readonly string[]>> = {
  "2026-11-21": [
    "Ahora puede cerrar su cuenta desde Mi cuenta con su contraseña y una confirmación expresa.",
    "Al cerrar la cuenta se revocan las sesiones, se desvincula Google y la identidad directa se reemplaza por un seudónimo.",
    "Los casos, evidencias, aceptaciones y registros que deban conservarse permanecen protegidos durante el plazo legal o contractual aplicable.",
  ],
  "2026-11-20": [
    "Cerrar un caso ahora lo mueve a un archivo histórico sin borrar sus archivos, huellas ni registros de custodia.",
    "Explicamos el plazo operativo inicial de diez años y que una obligación, orden o instrucción documentada puede exigir un plazo distinto.",
    "Cancelar un plan deja la información disponible en solo lectura para consulta y exportación; no elimina automáticamente los casos.",
    "Aclaramos que una solicitud de supresión se valida y no procede mientras exista un deber legal o contractual de conservar.",
  ],
  "2026-11-06": [
    "Identificamos a quien opera ALETHEIA con su NIT y su dirección. Los precios publicados son el valor final: no se cobra IVA.",
    "Explicamos cómo se contrata un plan, que no hay permanencia mínima y qué comprobante recibe con cada pago.",
    "Sus datos viajan a proveedores en Estados Unidos. Ellos los tratan por cuenta nuestra y con las reglas de la política.",
    "Si se arrepiente dentro de los cinco días hábiles siguientes a un pago, le devolvemos todo. El dinero vuelve en máximo quince días calendario.",
    "Cada política puede descargarse para conservar la versión vigente.",
  ],
};

/** Resumen de los cambios de los textos vigentes. */
export function currentLegalChanges(): readonly string[] {
  return LEGAL_CHANGES[LEGAL_VERSION] ?? [];
}
