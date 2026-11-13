// Tipo que declara quien sube la evidencia (DECLARED_TYPES en backend/app/models/evidence.py),
// en singular y en plural.
const EVIDENCE_TYPE_NAMES: Record<string, [string, string]> = {
  chat: ["chat", "chats"],
  email: ["correo", "correos"],
  audio: ["audio", "audios"],
  image: ["imagen", "imágenes"],
  document: ["documento", "documentos"],
  other: ["otro", "otros"],
};

const ORDER = Object.keys(EVIDENCE_TYPE_NAMES);

/** "9 chats, 2 audios, 1 documento": del tipo con más evidencias al que menos tiene. La API
 * omite los tipos sin evidencias: un tipo que no llega cuenta cero y no se muestra. Un tipo que
 * la interfaz todavía no nombra se cuenta igual, con su código. */
export function describeEvidenceByType(
  byType: Readonly<Record<string, number>>,
): string {
  const rank = (type: string) => {
    const index = ORDER.indexOf(type);
    return index === -1 ? ORDER.length : index;
  };
  return Object.entries(byType)
    .filter(([, count]) => count > 0)
    .sort(([a, countA], [b, countB]) => countB - countA || rank(a) - rank(b))
    .map(([type, count]) => {
      const names = EVIDENCE_TYPE_NAMES[type];
      const name = names ? names[count === 1 ? 0 : 1] : type;
      return `${count} ${name}`;
    })
    .join(", ");
}
