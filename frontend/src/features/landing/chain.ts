// Datos de la demostración de la cadena, aparte del componente para que la recarga en caliente
// de Vite siga funcionando (un archivo de componentes solo exporta componentes).

/** Huella "anterior" del primer evento: no hay nada antes de él. */
export const GENESIS = "0".repeat(64);

/** Lo que se resume en cada huella: la del evento anterior, la hora y lo que pasó. */
export function chainRecord(prev: string, time: string, text: string): string {
  return `${prev}|${time}|${text}`;
}

// Los mismos cuatro eventos de la vista del hero (EvidencePreview). Cada huella es la SHA-256
// real de chainRecord(huella anterior, hora, texto); la prueba la recalcula para que nadie
// pueda cambiar un texto sin cambiar también su huella.
export const CHAIN_EVENTS: { time: string; text: string; hash: string }[] = [
  {
    time: "10:39:04",
    text: "Laura Gómez subió el archivo original",
    hash: "1e9b138ee241f892cf989405079bbe3f1e0d9fd75a1ca34b0202b46ddf3497ab",
  },
  {
    time: "10:39:05",
    text: "Se registró la huella SHA-256",
    hash: "aef766335d2081901260b7da3eeb441bddf533faba9e1c441ae8ca400e9cc186",
  },
  {
    time: "10:39:07",
    text: "La autoridad externa emitió el sello de tiempo",
    hash: "1f03bd6ec2b0d8c56c266910b1072e9b3ddecbc4ec36f5e4dbda790516892391",
  },
  {
    time: "11:02:41",
    text: "Andrés Ruiz consultó la evidencia",
    hash: "1d6b111b56915382a66ae14b941eca6dd4a48bf80b06d3386328126f7bcf0b27",
  },
];
