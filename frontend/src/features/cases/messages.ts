// Textos de los casos (especificación de HU-015, sección 5.3). ALETHEIA preserva y documenta:
// ningún texto dice que certifica ni que determina la validez de una prueba.

/** MSG-010 del catálogo de mensajes. */
export const NOT_ALLOWED =
  "No tiene permiso para esta acción. Si lo necesita, pídalo al propietario o al administrador de su organización.";

export const CASE_MESSAGES = {
  emailNotVerified:
    "Verifique su correo para abrir casos. Le enviamos un enlace al crear la cuenta; si venció, pida uno nuevo",
  invalidFilingNumber:
    "El número de radicación tiene 23 dígitos. Revise que no falte ni sobre ninguno",
  filingNumberTaken:
    "Ya hay un caso con este número de radicación en su organización",
  keysUnavailable:
    "No pudimos preparar la llave de cifrado del caso. Inténtelo de nuevo en unos minutos",
  title: "Escriba el título del caso, de hasta 160 caracteres.",
  court: "Escriba el despacho con hasta 160 caracteres.",
  internalReference: "La referencia interna puede tener hasta 80 caracteres.",
  practiceArea: "Elija una especialidad de la lista.",
} as const;

/** Tipo de Problem Details del 409 por radicado repetido: comparte código con el 409 de la
 * organización en solo lectura, y solo el tipo los distingue (backend/app/api/cases.py). */
export const FILING_NUMBER_TAKEN_PROBLEM =
  "https://aletheia.sbs/problemas/radicado-repetido";
