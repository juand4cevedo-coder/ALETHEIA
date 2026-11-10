import { useEffect, useRef, useState } from "react";

/** Calcula el SHA-256 en minúsculas con la Web Crypto API del navegador. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Huella del texto, recalculada en el navegador. Mientras no llega el primer resultado (o si
 * el navegador no ofrece crypto.subtle) devuelve `fallback`.
 */
export function useSha256(
  text: string,
  fallback: string,
): { hash: string; supported: boolean } {
  const supported = Boolean(globalThis.crypto?.subtle);
  const [hash, setHash] = useState(fallback);
  const requestId = useRef(0);

  useEffect(() => {
    if (!supported) return;
    // Cada texto lleva un número de solicitud: si llega tarde la respuesta de uno anterior,
    // se descarta para no mostrar la huella de lo que ya no está escrito.
    const id = ++requestId.current;
    sha256Hex(text)
      .then((value) => {
        if (id === requestId.current) setHash(value);
      })
      .catch(() => {
        if (id === requestId.current) setHash(fallback);
      });
  }, [text, supported, fallback]);

  return { hash, supported };
}
