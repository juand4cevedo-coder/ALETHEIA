export const MAX_VERIFY_BYTES = 32 * 1024 * 1024;

/** Un único archivo en memoria y un límite explícito para equipos con pocos recursos. */
export async function digestFile(file: File): Promise<string> {
  if (file.size > MAX_VERIFY_BYTES) throw new Error("file-too-large");
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
