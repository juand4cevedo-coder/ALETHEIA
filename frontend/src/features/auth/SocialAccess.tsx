import { useEffect, useId, useState } from "react";
import styles from "./SocialAccess.module.css";

const STATUS_URL = "/api/v1/auth/google/status";

type Props = { mode?: "login" | "link"; linked?: boolean };

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

  const label = mode === "link" ? "Vincular Google" : "Continuar con Google";
  const href = `/api/v1/auth/google/${mode}`;
  return (
    <div className={styles.social}>
      <div className={styles.providers} aria-describedby={id}>
        {enabled ? (
          <a href={href} className={styles.provider}>
            <GoogleIcon />
            {label}
          </a>
        ) : (
          <button type="button" disabled>
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
              : "Disponible para cuentas que ya vincularon Google."
            : "El acceso con Google estará disponible cuando termine su configuración."}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.4c2-1.8 2.9-4.4 2.9-7.7ZM12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10.4 10.4 0 0 0 12 22ZM6.2 13.6a6.3 6.3 0 0 1 0-3.2V7.7H2.7a10 10 0 0 0 0 8.6l3.5-2.7ZM12 6.1c1.5 0 2.8.5 3.8 1.5l3-3A10 10 0 0 0 12 2a10.4 10.4 0 0 0-9.3 5.7l3.5 2.7C7 7.9 9.3 6.1 12 6.1Z"
      />
    </svg>
  );
}
