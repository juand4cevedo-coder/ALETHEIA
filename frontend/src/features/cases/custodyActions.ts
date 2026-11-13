// Nombre de cada acción de la cadena de custodia tal como lo lee la persona. La lista es cerrada
// (CUSTODY_ACTIONS en backend/app/models/evidence.py); una acción que todavía no tenga nombre
// aquí se muestra con su código, nunca se oculta.
export const CUSTODY_ACTION_LABELS: Record<string, string> = {
  case_created: "Caso creado",
  member_added: "Miembro agregado",
  member_removed: "Miembro retirado",
  evidence_uploaded: "Evidencia subida",
  evidence_stamped: "Sello de tiempo obtenido",
  evidence_stamp_failed: "Sello de tiempo fallido",
  evidence_downloaded: "Original descargado",
  export_requested: "Paquete solicitado",
  export_ready: "Paquete listo",
  export_downloaded: "Paquete descargado",
  chain_verified: "Cadena verificada",
  case_closed: "Caso cerrado",
  deletion_requested: "Eliminación solicitada",
};

export function custodyActionLabel(action: string): string {
  return CUSTODY_ACTION_LABELS[action] ?? action;
}

const STAMP_OUTCOMES = new Set(["evidence_stamped", "evidence_stamp_failed"]);

/** Posiciones de las evidencias subidas cuyo sello sigue pendiente con certeza: después de
 * ellas no hay ningún sello ni fallo de sello. El sello de una evidencia siempre llega después
 * de subirla, así que si no hay ninguno, el de esa evidencia no ha llegado. Con varias subidas y
 * algún sello después, la lista de acciones no dice cuál quedó pendiente; entonces no se marca
 * ninguna, y el total de sellos pendientes de la franja lo cuenta. */
export function pendingStampPositions(actions: readonly string[]): Set<number> {
  const pending = new Set<number>();
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index]!;
    if (STAMP_OUTCOMES.has(action)) break;
    if (action === "evidence_uploaded") pending.add(index);
  }
  return pending;
}
