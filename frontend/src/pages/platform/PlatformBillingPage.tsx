import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router";

import type { Me } from "../../api/generated";
import { platformBillingOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Meter } from "../../components/ui/Meter.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { PageHeader } from "../../components/ui/PageHeader.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { StatTile } from "../../components/ui/StatTile.tsx";
import { pageTitle } from "../../config/site.ts";
import { formatCop } from "../../features/billing/format.ts";
import styles from "./Platform.module.css";
import { SUBSCRIPTION_LABELS } from "./labels.ts";
import { Restricted } from "./shared.tsx";

// Ingresos: lo cobrado en el año frente al tope que obliga a facturar electrónicamente
// (Estatuto Tributario, art. 437, parágrafo 3), las suscripciones por estado y las
// notificaciones de pago que esperan proceso.
export function PlatformBillingPage() {
  const me = useOutletContext<Me>();
  const billing = useQuery({
    ...platformBillingOptions(),
    enabled: me.platform_admin,
  });
  const data = billing.data;
  const share = data
    ? Math.min(
        100,
        (data.collected_year_cop * 100) / data.invoicing_threshold_cop,
      )
    : 0;
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Ingresos de la plataforma")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Ingresos"
        description="Lo cobrado en el año, cuánto falta para el tope de facturación electrónica y el estado de las suscripciones."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <>
          {billing.isPending && <p role="status">Cargando los ingresos</p>}
          {billing.isError && (
            <Notice tone="error">No pudimos cargar los ingresos.</Notice>
          )}
          {data && (
            <>
              <Panel
                title={`Ingresos de ${data.collected_year} y factura electrónica`}
                description="Mientras no supere el tope, el comprobante de pago de ALETHEIA reemplaza la factura. Las cifras salen de los comprobantes emitidos."
              >
                <div className={styles.stats}>
                  <StatTile
                    label={`Cobrado en ${data.collected_year}`}
                    value={formatCop(data.collected_year_cop)}
                    note={`${data.receipts_year} comprobantes de pago`}
                  />
                  <StatTile
                    label="Tope para facturar"
                    value={formatCop(data.invoicing_threshold_cop)}
                    note={`${data.invoicing_threshold_uvt.toLocaleString("es-CO")} UVT, con la UVT en ${formatCop(data.uvt_value_cop)}`}
                  />
                </div>
                <Meter
                  label="Del tope usado"
                  value={share}
                  valueText={`${share.toFixed(1).replace(".", ",")} %`}
                  tone={share >= 100 ? "error" : share >= 80 ? "warn" : "ok"}
                  note={
                    share >= 100
                      ? "Superó el tope: hable con su contador sobre la factura electrónica."
                      : share >= 80
                        ? "Se acerca al tope: avise a su contador."
                        : "Por debajo del tope."
                  }
                />
              </Panel>
              <Panel title="Suscripciones por estado">
                <div className={styles.stats}>
                  {Object.entries(SUBSCRIPTION_LABELS).map(
                    ([status, label]) => (
                      <StatTile
                        key={status}
                        label={label}
                        value={data.subscription_counts[status] ?? 0}
                      />
                    ),
                  )}
                </div>
              </Panel>
              <Panel
                title="Notificaciones de pago"
                description="Lo que Wompi avisa a ALETHEIA. Una notificación sin procesar suele resolverse sola en minutos; si persiste, revise Operación."
              >
                <div className={styles.stats}>
                  <StatTile
                    label="Recibidas"
                    value={data.payment_events_received}
                  />
                  <StatTile
                    label="Sin procesar"
                    value={data.payment_events_pending}
                    note={
                      data.payment_events_pending > 0
                        ? "Esperando que Wompi confirme el pago."
                        : "Todo procesado."
                    }
                  />
                </div>
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}
