import { useOutletContext } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { listCasesOptions } from "../api/generated/@tanstack/react-query.gen.ts";

import type { Me } from "../api/generated";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { ResendVerification } from "../features/auth/ResendVerification.tsx";
import { EmailStatus } from "../features/session/EmailStatus.tsx";
import { ROLE_LABELS } from "../features/workspace/roles.ts";
import { canOpenCases } from "../features/cases/roles.ts";
import styles from "./WorkspacePage.module.css";
import {
  CarpetaAbiertaIcon,
  FlechaDerechaIcon,
  MasIcon,
} from "../components/ui/icons.tsx";

// Inicio del espacio de trabajo. Por ahora muestra a nombre de quién está la sesión, el estado
// real de la cuenta y el camino al libro de casos, donde se abren; HU-031 lo convierte en el
// tablero con casos, evidencias y exportaciones. Nada aquí anuncia funciones que no existen.
export function WorkspacePage() {
  const me = useOutletContext<Me>();
  const summary = useQuery({
    ...listCasesOptions({ query: { status: "open", limit: 1 } }),
    enabled: me.organization != null,
  });
  const totals = summary.data?.totals;

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Espacio de trabajo")}</title>
      <meta name="robots" content="noindex" />

      <div className={styles.welcome}>
        <p className={styles.eyebrow}>Su espacio de trabajo</p>
        <PageHeader
          title={me.full_name}
          actions={
            me.organization && (
              // Los casos se abren y se consultan en el libro de casos, para todos los roles. Con
              // el correo sin verificar, la acción que se espera es verificarlo: el botón principal
              // es el del enlace nuevo y este pasa a secundario.
              <ButtonLink
                to={ROUTES.cases}
                size="sm"
                variant={me.email_verified ? "primary" : "secondary"}
              >
                <CarpetaAbiertaIcon size={16} aria-hidden="true" />
                Ver mis casos
              </ButtonLink>
            )
          }
        />
        <p className={styles.welcomeText}>
          Cada detalle en su lugar. Continúe con los casos de su organización.
        </p>
      </div>

      {me.organization && (
        <>
          <section
            className={styles.overview}
            aria-label="Resumen de sus casos"
            aria-busy={summary.isPending}
          >
            {[
              { label: "Casos abiertos", value: totals?.open },
              { label: "Casos cerrados", value: totals?.closed },
              { label: "Registros de custodia", value: totals?.custody_events },
            ].map(({ label, value }) => (
              <div key={label} className={styles.metric}>
                <p>{label}</p>
                <strong>
                  {value ?? (summary.isPending ? "Cargando" : "No disponible")}
                </strong>
              </div>
            ))}
          </section>
          {summary.isError && (
            <p role="status" className={styles.note}>
              No pudimos cargar el resumen. Puede seguir trabajando desde la
              lista de casos.
            </p>
          )}
          <div className={styles.quickActions}>
            <div>
              <p className={styles.eyebrow}>El siguiente paso</p>
              <h2>Su trabajo continúa aquí.</h2>
              <p>
                Consulte el contexto de cada caso, su equipo responsable y su
                actividad.
              </p>
            </div>
            <div className={styles.actionLinks}>
              {canOpenCases(me.organization.role) && me.email_verified && (
                <ButtonLink to={ROUTES.newCase}>
                  <MasIcon size={18} aria-hidden="true" />
                  Abrir un caso
                </ButtonLink>
              )}
              <ButtonLink to={ROUTES.cases} variant="secondary">
                Ir al libro de casos
                <FlechaDerechaIcon size={18} aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>
        </>
      )}

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
            <EmailStatus verified={me.email_verified} />
          </dd>
        </div>
      </dl>

      {!me.email_verified && (
        <section className={styles.notice} aria-labelledby="titulo-verificar">
          <h2 id="titulo-verificar" className={styles.noticeTitle}>
            Verifique su correo
          </h2>
          <p className={styles.noticeText}>
            Abra el enlace que le enviamos al crear la cuenta. Hasta entonces no
            podrá abrir casos. Si el enlace venció o no le llegó, pida uno
            nuevo.
          </p>
          <div className={styles.resend}>
            <ResendVerification email={me.email} />
          </div>
        </section>
      )}

      {!me.organization && (
        <p className={styles.note}>
          Su cuenta ya no pertenece a ninguna organización. Para volver a
          trabajar en una, pida a su propietario que lo invite de nuevo.
        </p>
      )}
    </div>
  );
}
