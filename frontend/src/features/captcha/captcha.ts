import { captchaChallenge } from "../../api/generated";
import { type CaptchaChallenge, encodeSolution, findNumber } from "./solve.ts";

/** Nombre del encabezado en que viaja la solución. */
export const CAPTCHA_HEADER = "X-Aletheia-Captcha" as const;

function solveInWorker(challenge: CaptchaChallenge): Promise<number | null> {
  if (typeof Worker !== "function") return findNumber(challenge);
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./solve.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = (value: number | null) => {
      worker.terminate();
      resolve(value);
    };
    worker.onmessage = ({ data }: MessageEvent<{ number: number | null }>) =>
      finish(data.number);
    worker.onerror = () => finish(null);
    worker.postMessage(challenge);
  });
}

/** Pide un reto a la API, lo resuelve y devuelve la solución lista para enviar. */
export async function solveCaptcha(): Promise<string> {
  const { data } = await captchaChallenge({ throwOnError: true });
  const number = await solveInWorker(data);
  if (number === null) throw new Error("El reto no tuvo solución.");
  return encodeSolution(data, number);
}
