import { useId } from "react";
import styles from "./SocialAccess.module.css";

/** Los proveedores no se anuncian activos hasta disponer de un flujo OIDC completo. */
export function SocialAccess() {
  const id = useId();
  return (
    <div className={styles.social}>
      <div className={styles.providers} aria-describedby={id}>
        <button type="button" disabled>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.4c2-1.8 2.9-4.4 2.9-7.7ZM12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10.4 10.4 0 0 0 12 22ZM6.2 13.6a6.3 6.3 0 0 1 0-3.2V7.7H2.7a10 10 0 0 0 0 8.6l3.5-2.7ZM12 6.1c1.5 0 2.8.5 3.8 1.5l3-3A10 10 0 0 0 12 2a10.4 10.4 0 0 0-9.3 5.7l3.5 2.7C7 7.9 9.3 6.1 12 6.1Z"
            />
          </svg>
          Continuar con Google
        </button>
        <button type="button" disabled>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M1 1h8v8H1zM11 1h8v8h-8zM1 11h8v8H1zM11 11h8v8h-8z"
            />
          </svg>
          Continuar con Microsoft
        </button>
      </div>
      <p id={id} className={styles.pending}>
        Google y Microsoft estarán disponibles próximamente.
      </p>
      <div className={styles.divider}>
        <span>o continúe con su correo</span>
      </div>
    </div>
  );
}
