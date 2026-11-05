import { CircleAlert, CircleCheck } from "lucide-react";
import { useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import { SITE_NAME } from "../config/site.ts";
import { ResendVerification } from "../features/auth/ResendVerification.tsx";
import { ROLE_LABELS } from "../features/workspace/roles.ts";
import styles from "./WorkspacePage.module.css";

// Inicio del espacio de trabajo. Por ahora muestra a nombre de quién está la sesión y el
// estado real de la cuenta; HU-031 lo convierte en el tablero con casos, evidencias y
// exportaciones. Nada aquí anuncia funciones que todavía no existen.
export function WorkspacePage() {
  const me = useOutletContext<Me>();

  return (
    <section className={styles.screen} aria-labelledby="titulo-espacio">
      <title>{`Espacio de trabajo · ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />

      <header className={styles.intro}>
        <p className={styles.eyebrow}>Sesión iniciada</p>
        <h1 id="titulo-espacio" className={styles.title}>
          {me.full_name}
        </h1>
      </header>

      <dl className={styles.record}>
        <div className={styles.row}>
          <dt>Organización</dt>
          <dd>{me.organization?.name ?? "Sin organización"}</dd>
        </div>
        {me.organization && (
          <div className={styles.row}>
            <dt>Su rol</dt>
            <dd>{ROLE_LABELS[me.organization.role]}</dd>
          </div>
        )}
        <div className={styles.row}>
          <dt>Correo</dt>
          <dd className={styles.email}>
            <span translate="no">{me.email}</span>
            {me.email_verified ? (
              <span className={styles.verified}>
                <CircleCheck size={16} aria-hidden="true" />
                Verificado
              </span>
            ) : (
              <span className={styles.pending}>
                <CircleAlert size={16} aria-hidden="true" />
                Sin verificar
              </span>
            )}
          </dd>
        </div>
      </dl>

      {!me.email_verified && (
        <aside className={styles.notice} aria-labelledby="titulo-verificar">
          <h2 id="titulo-verificar" className={styles.noticeTitle}>
            Verifique su correo
          </h2>
          <p>
            Abra el enlace que le enviamos al crear la cuenta. Mientras el
            correo no esté verificado no podrá crear casos. Si el enlace venció
            o no le llegó, pida uno nuevo.
          </p>
          <ResendVerification />
        </aside>
      )}

      {!me.organization && (
        <p className={styles.note}>
          Su cuenta ya no pertenece a ninguna organización. Para volver a
          trabajar en una, pida a su propietario que lo invite de nuevo.
        </p>
      )}
    </section>
  );
}
