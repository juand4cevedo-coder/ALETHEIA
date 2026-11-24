import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import { listReceiptsOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { pageTitle } from "../config/site.ts";
import { formatCop } from "../features/billing/format.ts";
import { RenewalCard } from "../features/billing/RenewalCard.tsx";
import { formatColombiaTime } from "../features/cases/dates.ts";
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
      {mayPay && <RenewalCard />}
      {mayPay && <Receipts />}
    </div>
  );
}

const METHODS: Record<string, string> = {
  CARD: "Tarjeta",
  PSE: "PSE",
  NEQUI: "Nequi",
  BANCOLOMBIA_TRANSFER: "Transferencia Bancolombia",
  BANCOLOMBIA_COLLECT: "Bancolombia",
  DAVIPLATA: "Daviplata",
};

// Un comprobante de pago numerado por cada pago aprobado. No es una factura electrónica: el
// operador no está obligado a facturar, y el comprobante es el documento que ALETHEIA entrega.
function Receipts() {
  const receipts = useQuery({ ...listReceiptsOptions() });
  return (
    <Panel
      title="Comprobantes de pago"
      description="Cada pago aprobado deja un comprobante numerado de ALETHEIA, que también le llega por correo. No es una factura electrónica."
    >
      {receipts.isPending && <p role="status">Cargando los comprobantes</p>}
      {receipts.isError && (
        <Notice tone="error">No pudimos cargar los comprobantes.</Notice>
      )}
      {receipts.isSuccess && receipts.data.length === 0 && (
        <p className={styles.muted}>
          Todavía no hay pagos aprobados. Cuando pague, su comprobante aparece
          aquí.
        </p>
      )}
      {receipts.isSuccess && receipts.data.length > 0 && (
        <ul className={styles.receipts} aria-label="Comprobantes de pago">
          {receipts.data.map((receipt) => (
            <li key={receipt.id} className={styles.receipt}>
              <div>
                <strong translate="no">{receipt.number}</strong>
                <p className={styles.muted}>
                  {formatColombiaTime(receipt.issued_at).split(",")[0]}
                  {", plan "}
                  {receipt.plan_name},{" "}
                  {receipt.billing_cycle === "annual" ? "anual" : "mensual"}
                  {receipt.payment_method
                    ? `, ${METHODS[receipt.payment_method.toUpperCase()] ?? receipt.payment_method}`
                    : ""}
                </p>
              </div>
              <div className={styles.receiptEnd}>
                <span>{formatCop(receipt.amount_cop)}</span>
                <a
                  href={`/api/v1/billing/receipts/${receipt.id}/pdf`}
                  download
                  aria-label={`Descargar el comprobante ${receipt.number} en PDF`}
                >
                  Descargar PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
