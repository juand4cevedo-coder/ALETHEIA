import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useOutletContext } from "react-router";

import type { Me, PlatformOrganization } from "../../api/generated";
import { platformOrganizationsOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { DescargarIcon } from "../../components/ui/icons.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { PageHeader } from "../../components/ui/PageHeader.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { pageTitle } from "../../config/site.ts";
import { formatBytes } from "../../features/billing/format.ts";
import { downloadCsv } from "./csv.ts";
import styles from "./Platform.module.css";
import {
  ACCESS_LABELS,
  ORGANIZATION_LABELS,
  SUBSCRIPTION_LABELS,
} from "./labels.ts";
import { useCursorPager } from "./pager.ts";
import { DateText, Pager, Restricted } from "./shared.tsx";

type SubscriptionFilter =
  "" | "trial" | "active" | "past_due" | "canceled" | "expired";

const STATUS_TONE: Record<string, "ok" | "pending" | "error" | "muted"> = {
  active: "ok",
  trial: "pending",
  past_due: "error",
  canceled: "muted",
  expired: "muted",
};

function usage(org: PlatformOrganization): string {
  const used = formatBytes(org.storage_used_bytes);
  return org.storage_limit_bytes
    ? `${used} de ${formatBytes(org.storage_limit_bytes)}`
    : used;
}

// Directorio de despachos: quién usa Aletheia, con qué plan, cuánto espacio ocupa y cuándo
// vence su acceso. Solo datos comerciales; ningún caso ni evidencia.
export function PlatformOrganizationsPage() {
  const me = useOutletContext<Me>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SubscriptionFilter>("");
  const [applied, setApplied] = useState({
    search: "",
    status: "" as SubscriptionFilter,
  });
  const pager = useCursorPager();
  const organizations = useQuery({
    ...platformOrganizationsOptions({
      query: {
        search: applied.search || undefined,
        subscription_status: applied.status || undefined,
        cursor: pager.cursor,
      },
    }),
    enabled: me.platform_admin,
  });

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pager.reset();
    setApplied({ search: search.trim(), status });
  }

  function exportPage() {
    downloadCsv(
      "despachos-aletheia.csv",
      [
        "Despacho",
        "Responsable",
        "Correo",
        "Personas",
        "Plan",
        "Suscripción",
        "Acceso",
        "Vence",
        "Almacenamiento",
        "Creado",
      ],
      (organizations.data?.items ?? []).map((org) => [
        org.name,
        org.owner_name ?? "",
        org.owner_email ?? "",
        String(org.members),
        org.plan_name ?? "",
        SUBSCRIPTION_LABELS[org.subscription_status ?? ""] ?? "",
        ACCESS_LABELS[org.access_source ?? ""] ?? "",
        org.ends_at ?? "",
        usage(org),
        org.created_at,
      ]),
    );
  }

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Despachos")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Despachos"
        description="Cada oficina o abogado independiente que usa Aletheia, con su plan y su consumo."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={!organizations.data?.items.length}
            onClick={exportPage}
          >
            <DescargarIcon size={16} aria-hidden="true" />
            Exportar CSV
          </Button>
        }
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <Panel density="compact">
          <form
            className={styles.toolbar}
            onSubmit={apply}
            aria-label="Buscar despachos"
          >
            <Field
              label="Despacho o responsable"
              type="search"
              maxLength={120}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              label="Suscripción"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as SubscriptionFilter)
              }
              options={[
                { value: "", label: "Todas" },
                ...Object.entries(SUBSCRIPTION_LABELS).map(
                  ([value, label]) => ({
                    value,
                    label,
                  }),
                ),
              ]}
            />
            <Button type="submit">Buscar</Button>
          </form>
          {organizations.isPending && (
            <p role="status">Cargando los despachos</p>
          )}
          {organizations.isError && (
            <Notice tone="error">No pudimos cargar los despachos.</Notice>
          )}
          {organizations.data && (
            <p className={styles.resultCount} role="status">
              {organizations.data.total === 1
                ? "1 despacho"
                : `${organizations.data.total.toLocaleString("es-CO")} despachos`}
            </p>
          )}
          {organizations.data?.items.length === 0 && (
            <p className={styles.empty}>
              Ningún despacho coincide con la búsqueda.
            </p>
          )}
          {organizations.data && organizations.data.items.length > 0 && (
            <div className={styles.tableScroll}>
              <table className={styles.table} role="table">
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">
                      Despacho
                    </th>
                    <th scope="col" role="columnheader">
                      Plan
                    </th>
                    <th scope="col" role="columnheader">
                      Personas
                    </th>
                    <th scope="col" role="columnheader">
                      Almacenamiento
                    </th>
                    <th scope="col" role="columnheader">
                      Vence
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {organizations.data.items.map((org) => (
                    <tr role="row" key={org.id}>
                      <th scope="row" role="rowheader">
                        <span className={styles.cellTitle}>{org.name}</span>
                        <span className={styles.cellSub}>
                          {org.owner_name ?? "Sin responsable"}
                          {org.owner_email && (
                            <span translate="no">, {org.owner_email}</span>
                          )}
                        </span>
                      </th>
                      <td role="cell" data-label="Plan">
                        <span className={styles.cellTitle}>
                          {org.plan_name ?? "Sin plan"}
                        </span>
                        {org.subscription_status &&
                          (SUBSCRIPTION_LABELS[org.subscription_status] !==
                            org.plan_name ||
                            org.status !== "active") && (
                            <StatusBadge
                              tone={
                                STATUS_TONE[org.subscription_status] ?? "muted"
                              }
                            >
                              {SUBSCRIPTION_LABELS[org.subscription_status]}
                              {org.status !== "active" &&
                                `, ${ORGANIZATION_LABELS[org.status]?.toLowerCase()}`}
                            </StatusBadge>
                          )}
                      </td>
                      <td
                        role="cell"
                        data-label="Personas"
                        className={styles.number}
                      >
                        {org.members}
                      </td>
                      <td
                        role="cell"
                        data-label="Almacenamiento"
                        className={styles.number}
                      >
                        {usage(org)}
                      </td>
                      <td role="cell" data-label="Vence">
                        {org.ends_at ? (
                          <DateText value={org.ends_at} dateOnly />
                        ) : (
                          "Sin vencimiento"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager pager={pager} next={organizations.data?.next_cursor} />
        </Panel>
      )}
    </div>
  );
}
