import { type CaptchaChallenge, findNumber } from "./solve.ts";

// Resuelve el reto fuera del hilo principal: la página sigue respondiendo mientras tanto.
self.onmessage = async (event: MessageEvent<CaptchaChallenge>) => {
  if (event.origin && event.origin !== self.location.origin) return;
  try {
    self.postMessage({ number: await findNumber(event.data) });
  } catch {
    self.postMessage({ number: null });
  }
};
