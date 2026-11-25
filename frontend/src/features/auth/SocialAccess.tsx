import { useEffect, useId, useState } from "react";
import styles from "./SocialAccess.module.css";

const STATUS_URL = "/api/v1/auth/google/status";

type Props = { mode?: "login" | "link" | "register"; linked?: boolean };

/** Solo habilita Google cuando el backend confirma que tiene credenciales OIDC. */
export function SocialAccess({ mode = "login", linked = false }: Props) {
  const id = useId();
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          new Request(new URL(STATUS_URL, window.location.origin), {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }),
        );
        if (!response?.ok) return;
        const body = (await response.json()) as { enabled?: boolean };
        setEnabled(body.enabled === true);
      } catch {
        setEnabled(false);
      } finally {
        setChecked(true);
      }
    })();
    return () => controller.abort();
  }, []);

  if (linked) {
    return (
      <p className={styles.connected}>Google está vinculado a esta cuenta.</p>
    );
  }

  const label =
    mode === "link"
      ? "Vincular Google"
      : mode === "register"
        ? "Crear cuenta con Google"
        : "Continuar con Google";
  const href = `/api/v1/auth/google/${mode}`;
  return (
    <div className={styles.social}>
      <div className={styles.providers} aria-describedby={id}>
        {enabled && mode === "register" ? (
          <button type="submit" className={styles.provider}>
            <GoogleIcon />
            {label}
          </button>
        ) : enabled ? (
          <a href={href} className={styles.provider}>
            <GoogleIcon />
            {label}
          </a>
        ) : (
          <button type="button" className={styles.provider} disabled>
            <GoogleIcon />
            {label}
          </button>
        )}
      </div>
      <p id={id} className={styles.pending}>
        {!checked
          ? "Comprobando la disponibilidad de Google."
          : enabled
            ? mode === "link"
              ? "Aletheia no vincula cuentas solo porque coincida el correo."
              : mode === "register"
                ? "Google verificará su identidad antes de crear la cuenta."
                : "Si ese correo todavía no tiene cuenta, lo llevamos a crearla con Google."
            : "El acceso con Google estará disponible cuando termine su configuración."}
      </p>
    </div>
  );
}

/** La "G" de Google en sus cuatro colores, como pide su guía de marca para el botón. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
