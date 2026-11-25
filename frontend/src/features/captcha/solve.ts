// El cálculo de la verificación de persona (backend/app/services/captcha.py): encontrar el
// número entre 0 y maxnumber cuyo SHA-256 junto a la sal da el reto. Lo usa el hilo de trabajo
// y, si el navegador no tiene hilos, la página misma.

export type CaptchaChallenge = {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
};

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** El número que resuelve el reto, o null si no existe en el rango. */
export async function findNumber(
  challenge: CaptchaChallenge,
): Promise<number | null> {
  const encoder = new TextEncoder();
  for (let number = 0; number <= challenge.maxnumber; number++) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${challenge.salt}${number}`),
    );
    if (hex(digest) === challenge.challenge) return number;
  }
  return null;
}

/** La solución como la espera la API en el encabezado X-Aletheia-Captcha. */
export function encodeSolution(
  challenge: CaptchaChallenge,
  number: number,
): string {
  return btoa(
    JSON.stringify({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      number,
      salt: challenge.salt,
      signature: challenge.signature,
    }),
  );
}
