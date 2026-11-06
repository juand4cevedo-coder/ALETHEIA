import { LEGAL_VERSION } from "../../config/legal.ts";

// Qué cambió en cada fecha de los textos legales, en lenguaje sencillo. Es lo primero que lee
// quien tiene que aceptar unos textos nuevos (TT-012), así que cada fecha nueva de
// LEGAL_VERSION necesita aquí su resumen; una prueba lo exige. Solo resume: lo que rige es el
// texto completo de cada política.
export const LEGAL_CHANGES: Readonly<Record<string, readonly string[]>> = {
  "2026-11-06": [
    "Identificamos a quien opera ALETHEIA con su NIT y su dirección, y aclaramos que no cobra IVA: los precios publicados son el valor final.",
    "Explicamos cómo se contrata un plan, que no hay permanencia mínima y qué comprobante recibe con cada pago.",
    "Precisamos que sus datos viajan a nuestros proveedores en Estados Unidos para que los traten por cuenta nuestra y con las mismas reglas de la política.",
    "Mantenemos la devolución completa si se arrepiente dentro de cinco días hábiles, y el dinero vuelve en máximo quince días calendario.",
    "Cada política puede descargarse con su huella, para comprobar que guardó la versión vigente.",
  ],
};

/** Resumen de los cambios de los textos vigentes. */
export function currentLegalChanges(): readonly string[] {
  return LEGAL_CHANGES[LEGAL_VERSION] ?? [];
}
