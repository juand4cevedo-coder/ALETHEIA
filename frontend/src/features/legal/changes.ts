import { LEGAL_VERSION } from "../../config/legal.ts";

// Qué cambió en cada fecha de los textos legales, en lenguaje sencillo. Es lo primero que lee
// quien tiene que aceptar unos textos nuevos (TT-012), así que cada fecha nueva de
// LEGAL_VERSION necesita aquí su resumen; una prueba lo exige. Solo resume: lo que rige es el
// texto completo de cada política.
export const LEGAL_CHANGES: Readonly<Record<string, readonly string[]>> = {
  "2026-11-26": [
    "En los planes que admiten usuarios adicionales, cada periodo cuesta el plan más las personas por encima de las incluidas, contando los miembros del despacho y las invitaciones abiertas. En el pago anual, cada usuario adicional vale diez meses.",
    "La renovación automática cobra el plan con los usuarios adicionales que tenga el despacho el día del cobro, y el comprobante los muestra en una línea aparte.",
  ],
  "2026-11-25": [
    "Ahora puede radicar consultas, reclamos y reembolsos desde Pedir soporte: cada solicitud recibe al instante su radicado y la fecha límite de respuesta, contada en días hábiles de Colombia.",
    "Explicamos qué datos guardamos de los clientes del portal y de quienes descargan una evidencia compartida, y cómo pueden ejercer sus derechos.",
    "Contamos que la medición de rendimiento es opcional y anónima, y listamos todo lo que el sitio guarda en su navegador, incluido el modo de color que elija.",
    "Nombramos a Wompi como pasarela de pagos y aclaramos que Estados Unidos tiene un nivel adecuado de protección para la transmisión de sus datos.",
    "El plazo de conservación de los casos archivados es de diez años para todos los despachos y ya no se cambia desde la aplicación.",
    "Las solicitudes resueltas de ayuda pueden eliminarse; las de datos personales, consumidor y reembolsos se conservan tres años después de cerradas como prueba de la respuesta.",
    "Agregamos la garantía del servicio, cómo nos comunicamos con usted, la fuerza mayor y qué pasa si el servicio cambia de dueño.",
  ],
  "2026-11-24": [
    "Aclaramos que el plan no se renueva solo: por omisión usted decide cada periodo, y le avisamos siete días antes de que venza.",
    "Nueva renovación automática, opcional: la activa la persona responsable con su Nequi, autoriza el cobro con un texto exacto, la cancela cuando quiera y recibe un aviso siete días antes de cada cobro.",
    "Explicamos que cobrar después de cancelar la renovación automática se devuelve completo.",
    "Explicamos cómo funciona el portal del cliente, quién responde por lo que se comparte y que el cliente acepta un aviso antes de entrar.",
    "Aclaramos que eliminar un caso cerrado es definitivo y que los plazos y recordatorios de ALETHEIA no sustituyen la vigilancia de los términos procesales.",
  ],
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
