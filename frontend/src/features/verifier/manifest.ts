export type ManifestEvidence = {
  id: string;
  original_filename: string;
  path: string;
  sha256: string;
  size_bytes: number;
};

export type PreservationManifest = {
  format: "aletheia-preservation-manifest";
  format_version: 1;
  scope: "file-integrity";
  evidences: ManifestEvidence[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha256 = /^[0-9a-f]{64}$/;
const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseManifest(text: string): PreservationManifest {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("El manifiesto no contiene JSON válido.");
  }
  if (
    !record(value) ||
    value.format !== "aletheia-preservation-manifest" ||
    value.format_version !== 1 ||
    value.scope !== "file-integrity" ||
    !uuid.test(String(value.export_id)) ||
    !uuid.test(String(value.case_id)) ||
    typeof value.generated_at !== "string" ||
    !utcTimestamp.test(value.generated_at) ||
    !Array.isArray(value.evidences) ||
    !record(value.custody) ||
    !Number.isSafeInteger(value.custody.head_seq) ||
    (value.custody.head_seq as number) < 1 ||
    typeof value.custody.head_sha256 !== "string" ||
    !sha256.test(value.custody.head_sha256) ||
    value.custody.events_path !== "custody/events.json" ||
    (value.custody.anchor_token_path !== null &&
      value.custody.anchor_token_path !== "custody/head.tsr")
  ) {
    throw new Error(
      "El manifiesto no tiene el formato de preservación compatible.",
    );
  }
  const ids = new Set<string>();
  for (const item of value.evidences) {
    if (
      !record(item) ||
      typeof item.id !== "string" ||
      !uuid.test(item.id) ||
      ids.has(item.id) ||
      typeof item.original_filename !== "string" ||
      item.original_filename.length < 1 ||
      item.original_filename.length > 255 ||
      item.path !== `files/${item.id}` ||
      typeof item.sha256 !== "string" ||
      !sha256.test(item.sha256) ||
      !Number.isSafeInteger(item.size_bytes) ||
      (item.size_bytes as number) <= 0 ||
      !["pending", "stamped", "failed"].includes(String(item.tsa_status)) ||
      item.tsa_token_path !==
        (item.tsa_status === "stamped" ? `timestamps/${item.id}.tsr` : null)
    ) {
      throw new Error("El manifiesto contiene una evidencia inválida.");
    }
    ids.add(item.id);
  }
  return value as PreservationManifest;
}
