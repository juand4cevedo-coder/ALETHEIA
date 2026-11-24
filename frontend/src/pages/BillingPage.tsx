import { useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { pageTitle } from "../config/site.ts";
import { CheckoutCard } from "./CheckoutCard.tsx";
import styles from "./AccountPage.module.css";

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  trial: "Prueba",
  past_due: "Pago pendiente",
  expired: "Vencido",
  canceled: "Cancelado",
};

// Plan y facturación: el plan del despacho, hasta cuándo está pagado y cómo pagar o cambiarlo.
// Solo quien administra la facturación puede pagar; el resto ve el estado del plan.
export function BillingPage() {
  const me = useOutletContext<Me>();
  const subscription = me.subscription;
  const mayPay = me.permissions.includes("billing.manage");

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Plan y facturación")}</title>
      <meta name="robots" content="noindex" />

      <PageHeader
        title="Plan y facturación"
        description="El plan de su despacho, hasta cuándo está pagado y cómo pagarlo o cambiarlo."
      />

      {subscription ? (
        <Panel title="Plan del despacho">
          <dl className={styles.record}>
            <div className={styles.row}>
              <dt>Plan</dt>
              <dd>{subscription.plan_name}</dd>
            </div>
            <div className={styles.row}>
              <dt>Estado</dt>
              <dd>{STATUS_LABELS[subscription.status] ?? "Solo lectura"}</dd>
            </div>
            <div className={styles.row}>
              <dt>
                {subscription.status === "trial"
                  ? "La prueba termina"
                  : "Vence"}
              </dt>
              <dd>
                {subscription.ends_at
                  ? new Date(subscription.ends_at).toLocaleString("es-CO")
                  : "Sin fecha definida"}
              </dd>
            </div>
          </dl>
          {mayPay ? (
            <CheckoutCard me={me} />
          ) : (
            <Notice tone="info">
              Solo la persona responsable del despacho puede pagar o cambiar el
              plan.
            </Notice>
          )}
        </Panel>
      ) : (
        <Notice tone="info">Su cuenta todavía no tiene un plan.</Notice>
      )}
    </div>
  );
}
