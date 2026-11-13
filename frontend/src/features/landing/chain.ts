// Datos de la demostración de la cadena, aparte del componente para que la recarga en caliente
// de Vite siga funcionando (un archivo de componentes solo exporta componentes).

/** Huella "anterior" del primer evento: no hay nada antes de él. */
export const GENESIS = "0".repeat(64);

// La alteración que se demuestra: adelantar la hora de la descarga, el tipo de cambio que le
// interesaría a quien quiere mover la hora de un hecho.
export const ALTERED_INDEX = 2;
export const ALTERED_TIME = "09:02:41 a. m.";

/** Lo que se resume en cada huella: la del evento anterior, la hora y lo que pasó. */
export function chainRecord(prev: string, time: string, text: string): string {
  return `${prev}|${time}|${text}`;
}

// Cuatro eventos ilustrativos de una evidencia. Cada uno es una
// acción de la lista cerrada de custodia (custodyActions.ts): evidence_uploaded,
// evidence_stamped, evidence_downloaded y export_requested. Cada huella es la SHA-256 real de
// chainRecord(huella anterior, hora, texto); la prueba la recalcula para que nadie pueda cambiar
// un texto sin cambiar también su huella.
export const CHAIN_EVENTS: { time: string; text: string; hash: string }[] = [
  {
    time: "10:39:04 a. m.",
    text: "Laura Gómez subió el original con su huella SHA-256",
    hash: "d431f2552071fe26cc9d2c905adbb7f565d12855ec32998833a1c7be6c51fa8d",
  },
  {
    time: "10:39:07 a. m.",
    text: "La autoridad externa emitió el sello de tiempo",
    hash: "369d651391c0ed6199699f9c3a5b19910e85a933ed149637c02ba8ad5e2c8f09",
  },
  {
    time: "11:02:41 a. m.",
    text: "Andrés Ruiz descargó el original",
    hash: "8f90e2620bbe0694d6dceead008c3ca891880f986f6496af424bea88a023345d",
  },
  {
    time: "11:15:20 a. m.",
    text: "Laura Gómez solicitó el paquete de preservación",
    hash: "e87fa0d0ea481d3e5f9decfde7aab062df12e53abc190f7bafe2de765eb1c973",
  },
];
