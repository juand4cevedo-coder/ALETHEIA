import type { EvidenceSummaryOut } from "../../api/generated";

// Cómo se nombra el tipo de cada prueba en pantalla: el declarado por quien la subió y el que
// detectó el sistema, en palabras y no en tipos MIME.

export const TYPE_LABELS: Record<EvidenceSummaryOut["declared_type"], string> =
  {
    chat: "Conversación",
    email: "Correo",
    audio: "Audio",
    image: "Imagen",
    document: "Documento",
    other: "Otro",
  };

const DETECTED_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "Imagen PNG",
  "image/jpeg": "Imagen JPEG",
  "image/gif": "Imagen GIF",
  "application/zip": "Archivo ZIP",
  "audio/wav": "Audio WAV",
  "audio/mpeg": "Audio MP3",
  "text/plain": "Texto plano",
  "application/octet-stream": "Formato no identificado",
};

/** El tipo detectado dicho en palabras; si no se conoce, «Archivo» y la extensión del tipo. */
export function detectedTypeLabel(mime: string): string {
  return (
    DETECTED_LABELS[mime] ??
    `Archivo ${mime.split("/").pop()?.toUpperCase() ?? ""}`.trim()
  );
}
