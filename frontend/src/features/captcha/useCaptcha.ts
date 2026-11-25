import { useCallback, useEffect, useRef, useState } from "react";

import { solveCaptcha } from "./captcha.ts";

export type CaptchaStatus = "solving" | "ready" | "failed";

/**
 * Verificación de persona de un formulario. Empieza a resolverse apenas el formulario aparece,
 * mientras la persona escribe. `take` entrega una solución (esperando si aún no termina) y
 * prepara la siguiente, porque cada una sirve una sola vez.
 */
export function useCaptcha() {
  const pending = useRef<Promise<string> | null>(null);
  const [status, setStatus] = useState<CaptchaStatus>("solving");
  // Verdadero mientras un envío espera la solución: el botón se muestra ocupado.
  const [waiting, setWaiting] = useState(false);

  const start = useCallback(() => {
    const attempt = solveCaptcha();
    pending.current = attempt;
    attempt.then(
      () => {
        if (pending.current === attempt) setStatus("ready");
      },
      () => {
        if (pending.current === attempt) setStatus("failed");
      },
    );
    return attempt;
  }, []);

  useEffect(() => {
    void start().catch(() => undefined);
  }, [start]);

  const take = useCallback(async () => {
    const current = pending.current ?? start();
    setWaiting(true);
    try {
      return await current;
    } finally {
      setWaiting(false);
      void start().catch(() => undefined);
    }
  }, [start]);

  const retry = useCallback(() => {
    setStatus("solving");
    void start().catch(() => undefined);
  }, [start]);

  return { status, waiting, take, retry };
}
