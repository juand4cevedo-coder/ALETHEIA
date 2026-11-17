import { sha256 } from "@noble/hashes/sha2.js";

const CHUNK_SIZE = 1024 * 1024;

export async function hashBlob(
  file: Blob,
  onProgress: (bytes: number) => void,
): Promise<string> {
  const hash = sha256.create();
  for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
    const chunk = new Uint8Array(
      await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer(),
    );
    hash.update(chunk);
    onProgress(Math.min(offset + CHUNK_SIZE, file.size));
  }
  return Array.from(hash.digest(), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
