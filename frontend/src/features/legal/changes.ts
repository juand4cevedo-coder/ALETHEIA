import { LEGAL_VERSION } from "../../config/legal.ts";

// Qué cambió en cada fecha de los textos legales, en lenguaje sencillo. Es lo primero que lee
// quien tiene que aceptar unos textos nuevos (TT-012), así que cada fecha nueva de
// LEGAL_VERSION necesita aquí su resumen; una prueba lo exige. Solo resume: lo que rige es el
// texto completo de cada política.
export const LEGAL_CHANGES: Readonly<Record<string, readonly string[]>> = {
  "2026-11-06": [
    "Identificamos a quien opera ALETHEIA con su NIT y su dirección. Los precios publicados son el valor final: no se cobra IVA.",
    "Explicamos cómo se contrata un plan, que no hay permanencia mínima y qué comprobante recibe con cada pago.",
    "Sus datos viajan a proveedores en Estados Unidos. Ellos los tratan por cuenta nuestra y con las reglas de la política.",
    "Si se arrepiente dentro de los cinco días hábiles siguientes a un pago, le devolvemos todo. El dinero vuelve en máximo quince días calendario.",
    "Cada política puede descargarse con su huella, para comprobar que guardó la versión vigente.",
  ],
};

/** Resumen de los cambios de los textos vigentes. */
export function currentLegalChanges(): readonly string[] {
  return LEGAL_CHANGES[LEGAL_VERSION] ?? [];
}
