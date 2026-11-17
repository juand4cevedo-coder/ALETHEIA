import { describe, expect, it } from "vitest";

import { parseManifest } from "./manifest.ts";

const id = "01890a5d-ac96-774b-bcce-b302099a8060";
const manifest = {
  format: "aletheia-preservation-manifest",
  format_version: 1,
  scope: "file-integrity",
  export_id: "01890a5d-ac96-774b-bcce-b302099a8070",
  case_id: "01890a5d-ac96-774b-bcce-b302099a8058",
  generated_at: "2026-11-16T18:00:00.000000Z",
  custody: {
    head_seq: 1,
    head_sha256: "a".repeat(64),
    events_path: "custody/events.json",
    anchor_token_path: null,
  },
  evidences: [
    {
      id,
      original_filename: "archivo.txt",
      path: `files/${id}`,
      sha256: "b".repeat(64),
      size_bytes: 3,
      tsa_status: "pending",
      tsa_token_path: null,
    },
  ],
};

describe("manifiesto de preservación", () => {
  it("acepta la estructura que genera ADR-044", () => {
    expect(parseManifest(JSON.stringify(manifest)).evidences[0].id).toBe(id);
  });

  it("rechaza versiones, rutas y huellas incompatibles", () => {
    expect(() => parseManifest("{")).toThrow("JSON válido");
    expect(() =>
      parseManifest(JSON.stringify({ ...manifest, format_version: 2 })),
    ).toThrow("formato de preservación compatible");
    expect(() =>
      parseManifest(
        JSON.stringify({
          ...manifest,
          evidences: [{ ...manifest.evidences[0], path: "../archivo.txt" }],
        }),
      ),
    ).toThrow("evidencia inválida");
    expect(() =>
      parseManifest(
        JSON.stringify({
          ...manifest,
          evidences: [{ ...manifest.evidences[0], sha256: "b".repeat(63) }],
        }),
      ),
    ).toThrow("evidencia inválida");
  });
});
