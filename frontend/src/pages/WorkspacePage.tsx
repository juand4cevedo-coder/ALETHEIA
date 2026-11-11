import { useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { ResendVerification } from "../features/auth/ResendVerification.tsx";
import { ROLE_LABELS } from "../features/workspace/roles.ts";
import styles from "./WorkspacePage.module.css";
import {
  CarpetaAbiertaIcon,
  CirculoAlertaIcon,
  CirculoVistoIcon,
} from "../components/ui/icons.tsx";

// Inicio del espacio de trabajo. Por ahora muestra a nombre de quién está la sesión, el estado
// real de la cuenta y el camino al libro de casos, donde se abren; HU-031 lo convierte en el
// tablero con casos, evidencias y exportaciones. Nada aquí anuncia funciones que no existen.
export function WorkspacePage() {
  const me = useOutletContext<Me>();

  return (
    <section className={styles.screen} aria-labelledby="titulo-espacio">
      <title>{pageTitle("Espacio de trabajo")}</title>
      <meta name="robots" content="noindex" />

      <header className={styles.intro}>
        <p className={styles.eyebrow}>Sesión iniciada</p>
        <h1 id="titulo-espacio" className={styles.title}>
          {me.full_name}
        </h1>
        {me.organization && (
          // Los casos se abren y se consultan en el libro de casos, para todos los roles.
          <div className={styles.actions}>
            <ButtonLink to={ROUTES.cases} size="sm">
              <CarpetaAbiertaIcon size={16} aria-hidden="true" />
              Ver mis casos
            </ButtonLink>
          </div>
        )}
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
                <CirculoVistoIcon size={16} aria-hidden="true" />
                Verificado
              </span>
            ) : (
              <span className={styles.pending}>
                <CirculoAlertaIcon size={16} aria-hidden="true" />
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
            Abra el enlace que le enviamos al crear la cuenta. Hasta entonces no
            podrá abrir casos. Si el enlace venció o no le llegó, pida uno
            nuevo.
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
