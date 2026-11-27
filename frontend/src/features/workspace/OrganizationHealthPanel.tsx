import { useQuery } from "@tanstack/react-query";

import { organizationHealthOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { StatTile } from "../../components/ui/StatTile.tsx";
import {
  CandadoIcon,
  CirculoAlertaIcon,
  DiscoIcon,
  EscudoVistoIcon,
  RelojIcon,
  UsuarioAgregarIcon,
  UsuariosIcon,
} from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import { formatBytes } from "../billing/format.ts";
import { formatColombiaDate } from "../cases/dates.ts";
import styles from "./OrganizationHealthPanel.module.css";

const STATUS_LABELS: Record<string, string> = {
  trial: "en prueba",
  active: "activa",
  past_due: "con un pago pendiente",
  canceled: "cancelada, en solo lectura",
  expired: "vencida, en solo lectura",
};

function usagePercent(used: number, limit: number | null | undefined): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

// Salud del despacho: lo que quien lo gestiona necesita ver sin abrir ningún caso. Solo usa datos
// de la organización (plan, almacenamiento, cupo y seguridad de la última semana).
export function OrganizationHealthPanel() {
  const health = useQuery(organizationHealthOptions());

  if (health.isPending) {
    // Reserva el alto del panel: si no, al llegar los datos empuja todo lo de abajo.
    return (
      <section
        className={`${styles.panel} ${styles.placeholder}`}
        aria-busy="true"
      >
        <p role="status" className={styles.status}>
          Cargando la salud del despacho
        </p>
      </section>
    );
  }
  // Una respuesta con otra forma no debe tumbar el inicio: se trata como «sin datos».
  if (health.isError || !health.data?.security) {
    return (
      <Notice tone="error">
        <p>No pudimos consultar la salud del despacho.</p>
      </Notice>
    );
  }

  const data = health.data;
  const percent = usagePercent(
    data.storage_used_bytes,
    data.storage_limit_bytes,
  );
  const nearLimit = percent >= 80;
  const seatsFull = data.seats_used >= data.seats_included;
  const security = data.security;
  const status = data.subscription_status
    ? (STATUS_LABELS[data.subscription_status] ?? data.subscription_status)
    : null;

  return (
    <section className={styles.panel} aria-labelledby="salud-despacho">
      <div className={styles.head}>
        <div>
          <h2 id="salud-despacho">Salud del despacho</h2>
          <p>
            {[
              data.plan_name ? `Plan ${data.plan_name}` : "Sin plan",
              status &&
              status.toLowerCase() !==
                `en ${data.plan_name ?? ""}`.toLowerCase()
                ? status
                : null,
            ]
              .filter(Boolean)
              .join(", ")}
            {data.subscription_ends_at
              ? `, hasta el ${formatColombiaDate(data.subscription_ends_at)}`
              : ""}
            .
          </p>
        </div>
        <ButtonLink to={ROUTES.organizationAudit} variant="secondary" size="sm">
          <EscudoVistoIcon size={16} aria-hidden="true" />
          Ver la auditoría
        </ButtonLink>
      </div>

      <div className={styles.usage}>
        <div className={styles.meter} data-warn={nearLimit || undefined}>
          <div className={styles.meterLabel}>
            <span>
              <DiscoIcon size={16} aria-hidden="true" /> Almacenamiento
            </span>
            <strong>
              {formatBytes(data.storage_used_bytes)}
              {data.storage_limit_bytes
                ? ` de ${formatBytes(data.storage_limit_bytes)}`
                : ""}
            </strong>
          </div>
          <meter
            min={0}
            max={100}
            value={percent}
            aria-label={`Almacenamiento usado: ${percent} %`}
          />
          {nearLimit && (
            <p className={styles.hint}>
              Se acerca al límite de su plan: conviene liberar espacio o cambiar
              de plan.
            </p>
          )}
        </div>
        <div className={styles.meter} data-warn={seatsFull || undefined}>
          <div className={styles.meterLabel}>
            <span>
              <UsuariosIcon size={16} aria-hidden="true" /> Cupo de usuarios
            </span>
            <strong>
              {data.seats_used} de {data.seats_included}
            </strong>
          </div>
          <meter
            min={0}
            max={100}
            value={usagePercent(data.seats_used, data.seats_included)}
            aria-label={`Cupo de usuarios usado: ${data.seats_used} de ${data.seats_included}`}
          />
          {seatsFull && (
            <p className={styles.hint}>
              No cabe nadie más sin cambiar de plan.
            </p>
          )}
        </div>
      </div>

      <h3 className={styles.subhead}>
        Seguridad de los últimos {data.window_days} días
      </h3>
      <div className={styles.stats}>
        <StatTile icon={CandadoIcon} label="Ingresos" value={security.logins} />
        <StatTile
          icon={CirculoAlertaIcon}
          label="Ingresos fallidos"
          value={security.failed_logins}
          note={
            security.failed_logins >= 10
              ? "Son muchos: revise la auditoría."
              : undefined
          }
        />
        <StatTile
          icon={RelojIcon}
          label="Sesiones cerradas a la fuerza"
          value={security.sessions_revoked}
        />
        <StatTile
          icon={UsuariosIcon}
          label="Cambios de rol o retiros"
          value={security.role_changes}
        />
        <StatTile
          icon={UsuarioAgregarIcon}
          label="Invitaciones"
          value={security.invitations}
        />
      </div>
    </section>
  );
}
